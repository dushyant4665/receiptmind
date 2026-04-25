package cache

import (
	"context"
	"encoding/json"
	"errors"
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

var ErrCacheMiss = errors.New("cache miss")

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
	result, err := r.Client.Get(r.Ctx, key).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return result, err
}

func (r *RedisCache) Delete(key string) error {
	return r.Client.Del(r.Ctx, key).Err()
}

func (r *RedisCache) DeleteByPrefix(prefix string) error {
	var cursor uint64
	keys := make([]string, 0)

	for {
		batch, nextCursor, err := r.Client.Scan(r.Ctx, cursor, prefix+"*", 100).Result()
		if err != nil {
			return err
		}
		if len(batch) > 0 {
			keys = append(keys, batch...)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	if len(keys) == 0 {
		return nil
	}

	return r.Client.Del(r.Ctx, keys...).Err()
}

func (r *RedisCache) SetJSON(key string, value any, expiration time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return r.Set(key, raw, expiration)
}

func (r *RedisCache) GetJSON(key string, target any) error {
	raw, err := r.Get(key)
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(raw), target)
}

func (r *RedisCache) SetUserSession(userID string, sessionID string, ttl time.Duration) error {
	key := fmt.Sprintf("session:%s:%s", userID, sessionID)
	return r.Set(key, "active", ttl)
}

func (r *RedisCache) GetUserSessions(userID string) ([]string, error) {
	return r.scanKeys(fmt.Sprintf("session:%s:*", userID))
}

func (r *RedisCache) DeleteUserSessions(userID string) error {
	keys, err := r.scanKeys(fmt.Sprintf("session:%s:*", userID))
	if err != nil {
		return err
	}
	if len(keys) == 0 {
		return nil
	}
	return r.Client.Del(r.Ctx, keys...).Err()
}

func (r *RedisCache) Ping(ctx context.Context) error {
	if ctx == nil {
		ctx = r.Ctx
	}
	return r.Client.Ping(ctx).Err()
}

func (r *RedisCache) Close() error {
	return r.Client.Close()
}

func (r *RedisCache) scanKeys(pattern string) ([]string, error) {
	var cursor uint64
	keys := make([]string, 0)

	for {
		batch, nextCursor, err := r.Client.Scan(r.Ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, err
		}
		if len(batch) > 0 {
			keys = append(keys, batch...)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return keys, nil
}
