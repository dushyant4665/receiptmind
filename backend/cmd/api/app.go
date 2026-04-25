package main

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/etag"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"

	"github.com/receiptmind/backend/internal/cache"
	"github.com/receiptmind/backend/internal/config"
	"github.com/receiptmind/backend/internal/database"
	"github.com/receiptmind/backend/internal/handlers"
	"github.com/receiptmind/backend/internal/middleware"
	"github.com/receiptmind/backend/internal/services"
)

type appDependencies struct {
	db             *database.PostgresDB
	authService    *services.AuthService
	storageService *services.StorageService
	openAIService  *services.OpenAIService
	geminiService  *services.GeminiService
	redisCache     *cache.RedisCache
	runtimeConfig  config.RuntimeConfig
}

func newApp(deps appDependencies) *fiber.App {
	app := fiber.New(fiber.Config{
		ReadTimeout:             deps.runtimeConfig.ReadTimeout,
		WriteTimeout:            deps.runtimeConfig.WriteTimeout,
		IdleTimeout:             deps.runtimeConfig.IdleTimeout,
		BodyLimit:               deps.runtimeConfig.BodyLimit,
		Prefork:                 deps.runtimeConfig.Prefork,
		DisableStartupMessage:   deps.runtimeConfig.DisableStartupLog,
		EnableTrustedProxyCheck: deps.runtimeConfig.EnableProxyTrust,
		TrustedProxies:          deps.runtimeConfig.TrustedProxies,
		ProxyHeader:             fiber.HeaderXForwardedFor,
		EnableIPValidation:      deps.runtimeConfig.EnableProxyTrust,
	})

	app.Use(helmet.New())
	app.Use(requestid.New(requestid.Config{
		Header: deps.runtimeConfig.RequestIDHeader,
	}))
	app.Use(fiberLogger.New(fiberLogger.Config{Format: "[${time}] ${status} - ${method} ${path} ${latency}\n"}))
	app.Use(recover.New())
	app.Use(compress.New(compress.Config{Level: compress.LevelBestSpeed}))
	app.Use(etag.New())
	corsOrigins := strings.TrimSpace(deps.runtimeConfig.CORSAllowedOrigins)
	corsAllowCredentials := corsOrigins != "" && corsOrigins != "*"

	app.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: corsAllowCredentials,
	}))
	app.Use(limiter.New(limiter.Config{
		Max:        deps.runtimeConfig.RateLimitMax,
		Expiration: deps.runtimeConfig.RateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			if userID, ok := c.Locals("user_id").(string); ok && userID != "" {
				return "user:" + userID
			}
			return c.IP()
		},
	}))

	authHandler := handlers.NewAuthHandler(deps.db, deps.authService, deps.redisCache)
	userHandler := handlers.NewUserHandler(deps.db)
	expenseHandler := handlers.NewExpenseHandler(deps.db, deps.redisCache)
	receiptHandler := handlers.NewReceiptHandler(deps.db, deps.redisCache, deps.storageService, deps.openAIService, deps.geminiService)
	dashboardHandler := handlers.NewDashboardHandler(deps.db, deps.redisCache, deps.runtimeConfig.DashboardCacheTTL)
	categoryRulesHandler := handlers.NewCategoryRulesHandler(deps.db, deps.redisCache)
	exceptionsHandler := handlers.NewExceptionsHandler(deps.db, deps.redisCache)
	sseHandler := handlers.NewSSEHandler(deps.db, deps.redisCache)
	stripeHandler := handlers.NewStripeHandler()

	app.Get("/health", func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderCacheControl, "no-store")
		return c.JSON(fiber.Map{
			"status":      "ok",
			"environment": deps.runtimeConfig.AppEnv,
			"timestamp":   time.Now().Unix(),
		})
	})
	app.Get("/ready", func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderCacheControl, "no-store")

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		dbStatus := "ok"
		if err := deps.db.DB.PingContext(ctx); err != nil {
			dbStatus = "error"
		}

		redisStatus := "disabled"
		if deps.redisCache != nil {
			redisStatus = "ok"
			if err := deps.redisCache.Ping(ctx); err != nil {
				redisStatus = "error"
			}
		}

		statusCode := fiber.StatusOK
		if dbStatus != "ok" {
			statusCode = fiber.StatusServiceUnavailable
		}

		return c.Status(statusCode).JSON(fiber.Map{
			"status": fiber.Map{
				"database": dbStatus,
				"redis":    redisStatus,
			},
			"service":     "receiptmind-backend",
			"environment": deps.runtimeConfig.AppEnv,
			"timestamp":   time.Now().Unix(),
		})
	})

	api := app.Group("/api/v1")
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)
	auth.Post("/forgot-password", authHandler.ForgotPassword)

	protected := api.Group("/", middleware.AuthMiddleware(deps.authService))

	// Stripe checkout (requires auth)
	protected.Post("/checkout", stripeHandler.CreateCheckout)
	protected.Get("/users/me", userHandler.GetMe)
	protected.Put("/users/me", userHandler.UpdateMe)

	receipts := protected.Group("/receipts")
	receipts.Post("/upload", receiptHandler.Upload)
	receipts.Get("/", receiptHandler.List)
	receipts.Get("/:id", receiptHandler.Get)
	receipts.Delete("/:id", receiptHandler.Delete)
	receipts.Get("/export/csv", receiptHandler.ExportCSV)

	expenses := protected.Group("/expenses")
	expenses.Post("/", expenseHandler.CreateExpense)
	expenses.Get("/", expenseHandler.ListExpenses)
	expenses.Get("/:id", expenseHandler.GetExpense)
	expenses.Put("/:id", expenseHandler.UpdateExpense)
	expenses.Delete("/:id", expenseHandler.DeleteExpense)

	dashboard := protected.Group("/dashboard")
	dashboard.Get("/stats", dashboardHandler.Stats)
	dashboard.Get("/activity", dashboardHandler.Activity)

	rules := protected.Group("/rules")
	rules.Get("/", categoryRulesHandler.List)
	rules.Post("/", categoryRulesHandler.Create)
	rules.Get("/:id", categoryRulesHandler.Get)
	rules.Put("/:id", categoryRulesHandler.Update)
	rules.Delete("/:id", categoryRulesHandler.Delete)
	rules.Post("/apply/:receipt_id", categoryRulesHandler.Apply)

	exceptions := protected.Group("/exceptions")
	exceptions.Get("/", exceptionsHandler.List)
	exceptions.Get("/stats", exceptionsHandler.GetStats)
	exceptions.Get("/:id", exceptionsHandler.Get)
	exceptions.Post("/", exceptionsHandler.Create)
	exceptions.Post("/:id/resolve", exceptionsHandler.Resolve)
	exceptions.Post("/:id/dismiss", exceptionsHandler.Dismiss)

	sse := protected.Group("/sse")
	sse.Get("/stream", sseHandler.Stream)

	return app
}
