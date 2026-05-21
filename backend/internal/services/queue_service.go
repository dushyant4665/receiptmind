package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const (
	queueKey          = "receiptmind:jobs"
	highQueueKey      = "receiptmind:jobs:high"
	lowQueueKey       = "receiptmind:jobs:low"
	delayedQueueKey   = "receiptmind:jobs:delayed"
	deadLetterKey     = "receiptmind:dead_jobs"
	idempotencyPrefix = "receiptmind:job:idempotency:"
)

type QueueJob struct {
	ID             string                 `json:"id"`
	Type           string                 `json:"type"`
	Payload        map[string]interface{} `json:"payload"`
	Attempts       int                    `json:"attempts"`
	MaxAttempts    int                    `json:"max_attempts"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	LastError      string                 `json:"last_error,omitempty"`
	Priority       string                 `json:"priority,omitempty"`
}

type QueueService struct {
	client *redis.Client
}

func NewQueueService(redisClient *redis.Client) *QueueService {
	return &QueueService{client: redisClient}
}

func (q *QueueService) Enqueue(ctx context.Context, jobType string, payload map[string]interface{}) error {
	return q.EnqueueWithPriority(ctx, jobType, payload, "default")
}

func (q *QueueService) EnqueueWithPriority(ctx context.Context, jobType string, payload map[string]interface{}, priority string) error {
	job := QueueJob{
		ID:          uuid.NewString(),
		Type:        jobType,
		Payload:     payload,
		Attempts:    0,
		MaxAttempts: 3,
		CreatedAt:   time.Now().UTC(),
		Priority:    normalizePriority(priority),
	}
	if idempotencyKey, ok := payload["idempotency_key"].(string); ok {
		job.IdempotencyKey = idempotencyKey
	}
	return q.EnqueueJob(ctx, &job)
}

func (q *QueueService) EnqueueJob(ctx context.Context, job *QueueJob) error {
	if job.ID == "" {
		job.ID = uuid.NewString()
	}
	if job.MaxAttempts == 0 {
		job.MaxAttempts = 3
	}
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now().UTC()
	}
	job.Priority = normalizePriority(job.Priority)

	if job.IdempotencyKey != "" {
		ok, err := q.client.SetNX(ctx, idempotencyPrefix+job.IdempotencyKey, job.ID, 24*time.Hour).Result()
		if err != nil {
			return fmt.Errorf("failed to set job idempotency key: %w", err)
		}
		if !ok {
			log.Info().Str("type", job.Type).Str("idempotency_key", job.IdempotencyKey).Msg("Duplicate job skipped")
			return nil
		}
	}

	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		lastErr = q.client.LPush(ctx, q.queueKeyForPriority(job.Priority), data).Err()
		if lastErr == nil {
			log.Info().Str("job_id", job.ID).Str("type", job.Type).Str("priority", job.Priority).Msg("Job enqueued")
			return nil
		}
		log.Warn().Err(lastErr).Int("attempt", attempt).Msg("Enqueue failed, retrying")
		time.Sleep(time.Duration(attempt) * 100 * time.Millisecond)
	}

	return fmt.Errorf("failed to enqueue job after 3 attempts: %w", lastErr)
}

func (q *QueueService) EnqueueDelayed(ctx context.Context, job *QueueJob, delay time.Duration) error {
	runAt := time.Now().Add(delay).UnixMilli()
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal delayed job: %w", err)
	}
	if err := q.client.ZAdd(ctx, delayedQueueKey, redis.Z{Score: float64(runAt), Member: data}).Err(); err != nil {
		return fmt.Errorf("failed to enqueue delayed job: %w", err)
	}
	log.Warn().Str("job_id", job.ID).Dur("delay", delay).Int("attempts", job.Attempts).Msg("Job scheduled for retry")
	return nil
}

func (q *QueueService) EnqueueDeadLetter(ctx context.Context, job *QueueJob, reason string) {
	job.LastError = reason
	data, err := json.Marshal(job)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal dead-letter job")
		return
	}

	err = q.client.LPush(ctx, deadLetterKey, data).Err()
	if err != nil {
		log.Error().Err(err).Str("reason", reason).Msg("Failed to push to dead-letter queue")
		return
	}

	log.Warn().
		Str("type", job.Type).
		Int("attempts", job.Attempts).
		Str("reason", reason).
		Msg("Job moved to dead-letter queue")
}

func (q *QueueService) Dequeue(ctx context.Context) (*QueueJob, error) {
	if err := q.promoteDueJobs(ctx); err != nil {
		log.Warn().Err(err).Msg("Failed to promote delayed jobs")
	}

	result, err := q.client.BRPop(ctx, 5*time.Second, highQueueKey, queueKey, lowQueueKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, redis.Nil
		}
		return nil, fmt.Errorf("failed to pop job from queue: %w", err)
	}

	if len(result) < 2 {
		return nil, fmt.Errorf("unexpected result from BRPop")
	}

	var job QueueJob
	if err := json.Unmarshal([]byte(result[1]), &job); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job: %w", err)
	}

	return &job, nil
}

func (q *QueueService) promoteDueJobs(ctx context.Context) error {
	now := time.Now().UnixMilli()
	items, err := q.client.ZRangeByScore(ctx, delayedQueueKey, &redis.ZRangeBy{
		Min:   "0",
		Max:   fmt.Sprintf("%d", now),
		Count: 100,
	}).Result()
	if err != nil || len(items) == 0 {
		return err
	}

	for _, item := range items {
		pipe := q.client.TxPipeline()
		pipe.ZRem(ctx, delayedQueueKey, item)
		targetQueue := queueKey
		var job QueueJob
		if err := json.Unmarshal([]byte(item), &job); err == nil {
			targetQueue = q.queueKeyForPriority(job.Priority)
		}
		pipe.LPush(ctx, targetQueue, item)
		if _, err := pipe.Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (q *QueueService) QueueSize(ctx context.Context) (int64, error) {
	sizes, err := q.PriorityQueueSizes(ctx)
	if err != nil {
		return 0, err
	}
	return sizes["high"] + sizes["default"] + sizes["low"], nil
}

func (q *QueueService) PriorityQueueSizes(ctx context.Context) (map[string]int64, error) {
	pipe := q.client.Pipeline()
	high := pipe.LLen(ctx, highQueueKey)
	standard := pipe.LLen(ctx, queueKey)
	low := pipe.LLen(ctx, lowQueueKey)
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, err
	}
	return map[string]int64{"high": high.Val(), "default": standard.Val(), "low": low.Val()}, nil
}

func (q *QueueService) DeadLetterSize(ctx context.Context) (int64, error) {
	return q.client.LLen(ctx, deadLetterKey).Result()
}

func (q *QueueService) DelayedQueueSize(ctx context.Context) (int64, error) {
	return q.client.ZCard(ctx, delayedQueueKey).Result()
}

func (q *QueueService) queueKeyForPriority(priority string) string {
	switch normalizePriority(priority) {
	case "high":
		return highQueueKey
	case "low":
		return lowQueueKey
	default:
		return queueKey
	}
}

func normalizePriority(priority string) string {
	switch priority {
	case "high", "low":
		return priority
	default:
		return "default"
	}
}


