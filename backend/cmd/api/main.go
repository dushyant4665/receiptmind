package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/db"
	"receiptmind-backend/internal/services"
	"receiptmind-backend/internal/server"
	"receiptmind-backend/pkg/logger"
)

func main() {
	env := os.Getenv("ENVIRONMENT")
	logger.Init(env)

	cfg := config.Load()

	if err := cfg.Validate(); err != nil {
		log.Fatal().Err(err).Msg("Configuration validation failed")
	}

	ctx := context.Background()

	database, err := db.New(ctx, cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer database.Close()

	if err := db.RunMigrations(ctx, database); err != nil {
		log.Fatal().Err(err).Msg("Failed to run migrations")
	}

	redis, err := db.NewRedis(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	defer redis.Close()

	srv := server.New(cfg, database, redis)

	queueService := services.NewQueueService(redis.Client)
	aiService := services.NewAIService(cfg)
	exceptionService := services.NewExceptionService(database)
	ruleService := services.NewRuleService(database)
	storageService := services.NewStorageService(cfg)
	worker := services.NewWorker(queueService, database, aiService, exceptionService, ruleService, storageService, redis.Client, cfg.WorkerConcurrency)

	workerCtx, workerCancel := context.WithCancel(ctx)
	defer workerCancel()

	go worker.Start(workerCtx)

	go func() {
		log.Info().Str("port", cfg.Port).Msg("Starting server")
		if err := srv.Start(); err != nil {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server gracefully")

	workerCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := srv.App.ShutdownWithContext(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Server shutdown error")
	}

	database.Close()
	redis.Close()

	log.Info().Msg("Server stopped cleanly")
}

