package cache

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisCache struct {
	Client *redis.Client
	Ctx    context.Context
}

func NewRedisCache() (*RedisCache, error) {
	host := os.Getenv("REDIS_HOST")
	port := os.Getenv("REDIS_PORT")
	password := os.Getenv("REDIS_PASSWORD")

	addr := fmt.Sprintf("%s:%s", host, port)
	if host == "" {
		addr = "localhost:6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("Redis connected successfully")
	return &RedisCache{Client: client, Ctx: ctx}, nil
}

func (r *RedisCache) Set(key string, value interface{}, expiration time.Duration) error {
	return r.Client.Set(r.Ctx, key, value, expiration).Err()
}

func (r *RedisCache) Get(key string) (string, error) {
	return r.Client.Get(r.Ctx, key).Result()
}

func (r *RedisCache) Delete(key string) error {
	return r.Client.Del(r.Ctx, key).Err()
}

func (r *RedisCache) SetUserSession(userID string, sessionID string, ttl time.Duration) error {
	key := fmt.Sprintf("session:%s:%s", userID, sessionID)
	return r.Set(key, "active", ttl)
}

func (r *RedisCache) GetUserSessions(userID string) ([]string, error) {
	pattern := fmt.Sprintf("session:%s:*", userID)
	keys, err := r.Client.Keys(r.Ctx, pattern).Result()
	if err != nil {
		return nil, err
	}
	return keys, nil
}

func (r *RedisCache) DeleteUserSessions(userID string) error {
	pattern := fmt.Sprintf("session:%s:*", userID)
	keys, err := r.Client.Keys(r.Ctx, pattern).Result()
	if err != nil {
		return err
	}
	for _, key := range keys {
		if err := r.Delete(key); err != nil {
			return err
		}
	}
	return nil
}
