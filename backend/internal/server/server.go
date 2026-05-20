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
	PDFService       *services.PDFService
	EmailService     *services.EmailService
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
	pdfService := services.NewPDFService()
	emailService := services.NewEmailService(cfg)

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
		PDFService:       pdfService,
		EmailService:     emailService,
	}

	srv.setupRoutes()

	return srv
}

func (s *Server) setupRoutes() {
	healthHandler := handlers.NewHealthHandler(s.DB, s.Redis)
	authHandler := handlers.NewAuthHandler(s.DB, s.JWTService, s.EmailService, s.Config)
	userHandler := handlers.NewUserHandler(s.DB)
	receiptHandler := handlers.NewReceiptHandler(s.DB, s.Config, s.StorageService, s.QueueService, s.ExceptionService, s.RuleService, s.Redis.Client)
	exceptionHandler := handlers.NewExceptionHandler(s.DB, s.ExceptionService, s.RuleService)
	ruleHandler := handlers.NewRuleHandler(s.DB, s.RuleService)
	exportHandler := handlers.NewExportHandler(s.DB)
	dashboardHandler := handlers.NewDashboardHandler(s.DB, s.Redis.Client)
	fileHandler := handlers.NewFileHandler(s.DB, s.PDFService)
	metricsHandler := handlers.NewMetricsHandler(s.DB)

	s.App.Get("/health", healthHandler.Health)
	s.App.Get("/ready", healthHandler.Ready)

	// File serving endpoint
	s.App.Get("/api/files/:id", middleware.AuthProtected(s.JWTService), fileHandler.GetFile)

	auth := s.App.Group("/auth")
	auth.Post("/register", middleware.RateLimit(s.Redis.Client, "signup", 5, 10*time.Minute), authHandler.Register)
	auth.Post("/login", middleware.RateLimit(s.Redis.Client, "login", 5, 1*time.Minute), authHandler.Login)
	auth.Post("/forgot-password", middleware.RateLimit(s.Redis.Client, "forgot-password", 5, 10*time.Minute), authHandler.ForgotPassword)
	auth.Post("/verify-email", authHandler.VerifyEmail)
	auth.Post("/resend-verification", authHandler.ResendVerification)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)
	auth.Post("/logout-all", middleware.AuthProtected(s.JWTService), authHandler.LogoutAll)

	users := s.App.Group("/users", middleware.AuthProtected(s.JWTService))
	users.Get("/me", userHandler.GetMe)
	users.Put("/me", userHandler.UpdateMe)

	receipts := s.App.Group("/receipts", middleware.AuthProtected(s.JWTService))
	receipts.Post("/upload", middleware.RateLimit(s.Redis.Client, "upload", 10, 1*time.Minute), receiptHandler.Upload)
	receipts.Post("/bulk/export", receiptHandler.BulkExportReceipts)
	receipts.Delete("/bulk", receiptHandler.BulkDeleteReceipts)
	receipts.Get("/export/csv", exportHandler.ExportCSV)
	receipts.Get("/exports/history", exportHandler.History)
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

	metrics := s.App.Group("/metrics", middleware.AuthProtected(s.JWTService))
	metrics.Get("/processing-times", metricsHandler.GetProcessingTimes)

	s.App.Get("/dashboard", middleware.AuthProtected(s.JWTService), dashboardHandler.GetStats)
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
