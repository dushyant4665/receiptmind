package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/server"
	"receiptmind-backend/internal/services"
	"receiptmind-backend/pkg/logger"
)

func main() {
	logger.Init(os.Getenv("ENVIRONMENT"))

	cfg := config.Load()

	if err := cfg.Validate(); err != nil {
		log.Fatal().Err(err).Msg("Configuration validation failed")
	}

	ctx := context.Background()

	db, err := database.New(ctx, cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	if err := database.RunMigrations(ctx, db); err != nil {
		log.Fatal().Err(err).Msg("Failed to run migrations")
	}

	redis, err := database.NewRedis(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	defer redis.Close()

	srv := server.New(cfg, db, redis)

	queueService := services.NewQueueService(redis.Client)
	aiService := services.NewAIService(cfg)
	exceptionService := services.NewExceptionService(db)
	ruleService := services.NewRuleService(db)
	storageService := services.NewStorageService(cfg)
	worker := services.NewWorker(queueService, db, aiService, exceptionService, ruleService, storageService, cfg.WorkerConcurrency)

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

	db.Close()
	redis.Close()

	log.Info().Msg("Server stopped cleanly")
}
