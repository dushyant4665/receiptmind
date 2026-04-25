package handlers

import (
	"reflect"
	"time"
)

type cacheStore interface {
	Get(key string) (string, error)
	Set(key string, value interface{}, expiration time.Duration) error
	SetJSON(key string, value any, expiration time.Duration) error
	DeleteByPrefix(prefix string) error
}

func normalizeCacheStore(store cacheStore) cacheStore {
	if store == nil {
		return nil
	}

	value := reflect.ValueOf(store)
	if value.Kind() == reflect.Ptr && value.IsNil() {
		return nil
	}

	return store
}
