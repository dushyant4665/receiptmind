package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
)

type Database struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, cfg *config.Config) (*Database, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database url: %w", err)
	}

	poolCfg.MaxConns = int32(cfg.MaxDBConns())
	poolCfg.MinConns = int32(cfg.MinDBConns())
	poolCfg.MaxConnLifetime = cfg.MaxConnLifetime()
	poolCfg.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	log.Info().
		Int32("max_conns", poolCfg.MaxConns).
		Int32("min_conns", poolCfg.MinConns).
		Dur("max_conn_lifetime", poolCfg.MaxConnLifetime).
		Msg("Database connection pool established")

	return &Database{Pool: pool}, nil
}

func (db *Database) Health(ctx context.Context) error {
	return db.Pool.Ping(ctx)
}

func (db *Database) Close() {
	db.Pool.Close()
	log.Info().Msg("Database connection pool closed")
}
