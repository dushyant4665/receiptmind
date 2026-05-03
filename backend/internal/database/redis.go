package database

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

type RedisClient struct {
	Client *redis.Client
}

func NewRedis(ctx context.Context, redisURL string) (*RedisClient, error) {
	u, err := url.Parse(redisURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse redis url: %w", err)
	}

	pw, _ := u.User.Password()
	db := 0

	client := redis.NewClient(&redis.Options{
		Addr:            u.Host,
		Password:        pw,
		DB:              db,
		DialTimeout:     5 * time.Second,
		ReadTimeout:     3 * time.Second,
		WriteTimeout:    3 * time.Second,
		PoolSize:        10,
		MinIdleConns:    3,
		MaxRetries:      3,
		MinRetryBackoff: 100 * time.Millisecond,
		MaxRetryBackoff: 2 * time.Second,
	})

	var lastErr error
	for attempt := 1; attempt <= 5; attempt++ {
		lastErr = client.Ping(ctx).Err()
		if lastErr == nil {
			break
		}
		log.Warn().Err(lastErr).Int("attempt", attempt).Msg("Redis ping failed, retrying")
		time.Sleep(time.Duration(attempt) * 2 * time.Second)
	}

	if lastErr != nil {
		return nil, fmt.Errorf("unable to ping redis after 5 attempts: %w", lastErr)
	}

	log.Info().Str("addr", u.Host).Msg("Redis connection established")

	return &RedisClient{Client: client}, nil
}

func (r *RedisClient) Close() error {
	if err := r.Client.Close(); err != nil {
		return err
	}
	log.Info().Msg("Redis connection closed")
	return nil
}
