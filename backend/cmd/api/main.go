package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"

	"github.com/receiptmind/backend/internal/cache"
	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/handlers"
	"github.com/receiptmind/backend/internal/middleware"
	"github.com/receiptmind/backend/internal/services"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment")
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

	storageService, err := services.NewStorageService(context.Background())
	if err != nil {
		log.Println("R2 storage not configured, receipt upload will fail:", err)
		storageService = nil
	}

	authHandler := handlers.NewAuthHandler(db, authService, redisCache)
	userHandler := handlers.NewUserHandler(db)
	expenseHandler := handlers.NewExpenseHandler(db)
	receiptHandler := handlers.NewReceiptHandler(db, storageService, openAIService)
	dashboardHandler := handlers.NewDashboardHandler(db)

	app := fiber.New(fiber.Config{
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
		BodyLimit:    10 * 1024 * 1024,
	})

	app.Use(helmet.New())
	app.Use(fiberLogger.New(fiberLogger.Config{Format: "[${time}] ${status} - ${method} ${path} ${latency}\n"}))
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     os.Getenv("CORS_ALLOWED_ORIGINS"),
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))
	app.Use(limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "timestamp": time.Now().Unix()})
	})

	api := app.Group("/api/v1")
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)

	protected := api.Group("/", middleware.AuthMiddleware(authService))
	protected.Get("/users/me", userHandler.GetMe)
	protected.Put("/users/me", userHandler.UpdateMe)

	receipts := protected.Group("/receipts")
	receipts.Post("/upload", receiptHandler.Upload)
	receipts.Get("/", receiptHandler.List)
	receipts.Get("/:id", receiptHandler.Get)
	receipts.Delete("/:id", receiptHandler.Delete)

	expenses := protected.Group("/expenses")
	expenses.Post("/", expenseHandler.CreateExpense)
	expenses.Get("/", expenseHandler.ListExpenses)
	expenses.Get("/:id", expenseHandler.GetExpense)
	expenses.Put("/:id", expenseHandler.UpdateExpense)
	expenses.Delete("/:id", expenseHandler.DeleteExpense)

	dashboard := protected.Group("/dashboard")
	dashboard.Get("/stats", dashboardHandler.Stats)
	dashboard.Get("/activity", dashboardHandler.Activity)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
