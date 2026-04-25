package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"github.com/receiptmind/backend/internal/cache"
	"github.com/receiptmind/backend/internal/config"
	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/services"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment")
	}

	runtimeConfig, err := config.LoadRuntimeConfig()
	if err != nil {
		log.Fatal("Invalid runtime configuration:", err)
	}

	db, err := database.NewPostgresDB()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := db.RunMigrations(); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	redisCache, err := cache.NewRedisCache()
	if err != nil {
		log.Println("Redis not available, continuing without cache:", err)
		redisCache = nil
	}

	authService := services.NewAuthService()
	openAIService := services.NewOpenAIService()
	geminiService := services.NewGeminiService()

	storageService, err := services.NewStorageService(context.Background())
	if err != nil {
		log.Println("R2 storage not configured, receipt upload will fail:", err)
		storageService = nil
	}

	app := newApp(appDependencies{
		db:             db,
		authService:    authService,
		storageService: storageService,
		openAIService:  openAIService,
		geminiService:  geminiService,
		redisCache:     redisCache,
		runtimeConfig:  runtimeConfig,
	})

	defer func() {
		if redisCache != nil {
			_ = redisCache.Close()
		}
	}()

	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("Server starting on port %s", runtimeConfig.Port)
		serverErrors <- app.Listen(":" + runtimeConfig.Port)
	}()

	shutdownSignals := make(chan os.Signal, 1)
	signal.Notify(shutdownSignals, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		if err != nil {
			log.Fatal("Failed to start server:", err)
		}
	case sig := <-shutdownSignals:
		log.Printf("Received signal %s, shutting down gracefully", sig)
		if err := app.ShutdownWithTimeout(runtimeConfig.ShutdownTimeout); err != nil {
			log.Fatal("Failed to shut down cleanly:", err)
		}
	}
}
