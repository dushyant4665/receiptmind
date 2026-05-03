package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const (
	queueKey      = "receiptmind:jobs"
	deadLetterKey = "receiptmind:dead_jobs"
)

type QueueJob struct {
	Type     string                 `json:"type"`
	Payload  map[string]interface{} `json:"payload"`
	Attempts int                    `json:"attempts"`
}

type QueueService struct {
	client *redis.Client
}

func NewQueueService(redisClient *redis.Client) *QueueService {
	return &QueueService{client: redisClient}
}

func (q *QueueService) Enqueue(ctx context.Context, jobType string, payload map[string]interface{}) error {
	job := QueueJob{
		Type:     jobType,
		Payload:  payload,
		Attempts: 0,
	}

	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		lastErr = q.client.LPush(ctx, queueKey, data).Err()
		if lastErr == nil {
			log.Info().Str("type", jobType).Msg("Job enqueued")
			return nil
		}
		log.Warn().Err(lastErr).Int("attempt", attempt).Msg("Enqueue failed, retrying")
		time.Sleep(time.Duration(attempt) * 100 * time.Millisecond)
	}

	return fmt.Errorf("failed to enqueue job after 3 attempts: %w", lastErr)
}

func (q *QueueService) EnqueueDeadLetter(ctx context.Context, job *QueueJob, reason string) {
	job.Attempts++
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
	result, err := q.client.BRPop(ctx, 0, queueKey).Result()
	if err != nil {
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

func (q *QueueService) QueueSize(ctx context.Context) (int64, error) {
	return q.client.LLen(ctx, queueKey).Result()
}

func (q *QueueService) DeadLetterSize(ctx context.Context) (int64, error) {
	return q.client.LLen(ctx, deadLetterKey).Result()
}
