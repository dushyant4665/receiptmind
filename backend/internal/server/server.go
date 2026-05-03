package server

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
	"receiptmind-backend/internal/handlers"
	"receiptmind-backend/internal/middleware"
	"receiptmind-backend/internal/services"
)

type Server struct {
	App              *fiber.App
	Config           *config.Config
	DB               *database.Database
	Redis            *database.RedisClient
	JWTService       *services.JWTService
	StorageService   *services.StorageService
	QueueService     *services.QueueService
	AIService        *services.AIService
	ExceptionService *services.ExceptionService
	RuleService      *services.RuleService
}

func New(cfg *config.Config, db *database.Database, redis *database.RedisClient) *Server {
	app := fiber.New(fiber.Config{
		AppName:               "ReceiptMind API",
		ErrorHandler:          errorHandler,
		DisableStartupMessage: false,
		ReadTimeout:           cfg.RequestTimeout,
		WriteTimeout:          cfg.RequestTimeout,
	})

	app.Use(recover.New())
	app.Use(middleware.RequestID())
	app.Use(middleware.SecurityHeaders())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))
	app.Use(middleware.RequestLogger())

	// Static file serving for uploads (local storage fallback)
	app.Static("/uploads", "./uploads")

	jwtService := services.NewJWTService(cfg)
	storageService := services.NewStorageService(cfg)
	queueService := services.NewQueueService(redis.Client)
	aiService := services.NewAIService(cfg)
	exceptionService := services.NewExceptionService(db)
	ruleService := services.NewRuleService(db)

	srv := &Server{
		App:              app,
		Config:           cfg,
		DB:               db,
		Redis:            redis,
		JWTService:       jwtService,
		StorageService:   storageService,
		QueueService:     queueService,
		AIService:        aiService,
		ExceptionService: exceptionService,
		RuleService:      ruleService,
	}

	srv.setupRoutes()

	return srv
}

func (s *Server) setupRoutes() {
	healthHandler := handlers.NewHealthHandler(s.DB, s.Redis)
	authHandler := handlers.NewAuthHandler(s.DB, s.JWTService)
	userHandler := handlers.NewUserHandler(s.DB)
	receiptHandler := handlers.NewReceiptHandler(s.DB, s.Config, s.StorageService, s.QueueService, s.ExceptionService, s.RuleService)
	exceptionHandler := handlers.NewExceptionHandler(s.DB, s.ExceptionService, s.RuleService)
	ruleHandler := handlers.NewRuleHandler(s.DB, s.RuleService)
	emailHandler := handlers.NewEmailHandler(s.DB, s.Config, s.StorageService, s.QueueService, s.Redis.Client)
	exportHandler := handlers.NewExportHandler(s.DB)
	dashboardHandler := handlers.NewDashboardHandler(s.DB, s.Redis.Client)
	metricsHandler := handlers.NewMetricsHandler(s.DB, s.Redis.Client)

	s.App.Get("/health", healthHandler.Health)
	s.App.Get("/ready", healthHandler.Ready)

	auth := s.App.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", middleware.RateLimit(s.Redis.Client, "login", 5, 1*time.Minute), authHandler.Login)

	email := s.App.Group("/email")
	email.Post("/inbound", emailHandler.Inbound)

	users := s.App.Group("/users", middleware.AuthProtected(s.JWTService))
	users.Get("/me", userHandler.GetMe)
	users.Put("/me", userHandler.UpdateMe)

	email.Get("/inbox", middleware.AuthProtected(s.JWTService), emailHandler.Inbox)

	receipts := s.App.Group("/receipts", middleware.AuthProtected(s.JWTService))
	receipts.Post("/upload", middleware.RateLimit(s.Redis.Client, "upload", 10, 1*time.Minute), receiptHandler.Upload)
	receipts.Get("/export/csv", exportHandler.ExportCSV)
	receipts.Get("/:id", receiptHandler.GetReceipt)
	receipts.Get("/", receiptHandler.ListReceipts)
	receipts.Patch("/:id", receiptHandler.EditReceipt)
	receipts.Delete("/:id", receiptHandler.DeleteReceipt)

	expenses := s.App.Group("/expenses", middleware.AuthProtected(s.JWTService))
	expenses.Get("/", receiptHandler.ListExpenses)

	exceptions := s.App.Group("/exceptions", middleware.AuthProtected(s.JWTService))
	exceptions.Get("/", exceptionHandler.ListExceptions)
	exceptions.Post("/:id/resolve", exceptionHandler.ResolveException)

	rules := s.App.Group("/rules", middleware.AuthProtected(s.JWTService))
	rules.Post("/", ruleHandler.CreateRule)
	rules.Get("/", ruleHandler.ListRules)

	s.App.Get("/dashboard", middleware.AuthProtected(s.JWTService), dashboardHandler.GetStats)

	s.App.Get("/metrics", metricsHandler.GetMetrics)
}

func (s *Server) Start() error {
	addr := ":" + s.Config.Port
	return s.App.Listen(addr)
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return c.Status(code).JSON(handlers.ErrorResponse(err.Error()))
}
