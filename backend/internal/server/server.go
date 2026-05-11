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
	EmailService     *services.EmailService
	QuotaService     *services.QuotaService
	AuditService     *services.AuditService
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
	emailService := services.NewEmailService(cfg)
	quotaService := services.NewQuotaService(db, cfg, emailService)
	auditService := services.NewAuditService(db)
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
		EmailService:     emailService,
		QuotaService:     quotaService,
		AuditService:     auditService,
		ExceptionService: exceptionService,
		RuleService:      ruleService,
	}

	srv.setupRoutes()

	return srv
}

func (s *Server) setupRoutes() {
	healthHandler := handlers.NewHealthHandler(s.DB, s.Redis)
	authHandler := handlers.NewAuthHandler(s.DB, s.JWTService, s.EmailService, s.Config)
	userHandler := handlers.NewUserHandler(s.DB)
	receiptHandler := handlers.NewReceiptHandler(s.DB, s.Config, s.StorageService, s.QueueService, s.ExceptionService, s.RuleService, s.QuotaService, s.AuditService, s.Redis.Client)
	exceptionHandler := handlers.NewExceptionHandler(s.DB, s.ExceptionService, s.RuleService)
	ruleHandler := handlers.NewRuleHandler(s.DB, s.RuleService, s.AuditService)
	emailHandler := handlers.NewEmailHandler(s.DB, s.Config, s.StorageService, s.QueueService, s.QuotaService, s.AuditService, s.Redis.Client)
	exportHandler := handlers.NewExportHandler(s.DB, s.AuditService)
	dashboardHandler := handlers.NewDashboardHandler(s.DB, s.Redis.Client)
	metricsHandler := handlers.NewMetricsHandler(s.DB, s.Redis.Client)
	billingHandler := handlers.NewBillingHandler(s.DB, s.Config)
	integrationHandler := handlers.NewIntegrationHandler(s.Config, s.DB, s.Redis.Client, services.NewGoogleSheetsService(s.Config, s.DB))
	accountantHandler := handlers.NewAccountantHandler(s.DB)
	bankHandler := handlers.NewBankHandler(s.DB, s.AuditService)
	opsHandler := handlers.NewOpsHandler(s.DB, s.Redis.Client)
	onboardingHandler := handlers.NewOnboardingHandler(s.DB)

	s.App.Get("/health", healthHandler.Health)
	s.App.Get("/ready", healthHandler.Ready)

	auth := s.App.Group("/auth")
	auth.Post("/register", middleware.RateLimit(s.Redis.Client, "signup", 5, 10*time.Minute), authHandler.Register)
	auth.Post("/login", middleware.RateLimit(s.Redis.Client, "login", 5, 1*time.Minute), authHandler.Login)
	auth.Post("/forgot-password", middleware.RateLimit(s.Redis.Client, "forgot-password", 5, 10*time.Minute), authHandler.ForgotPassword)
	auth.Post("/verify-email", authHandler.VerifyEmail)
	auth.Post("/resend-verification", middleware.RateLimit(s.Redis.Client, "resend-verification", 3, 10*time.Minute), authHandler.ResendVerification)
	auth.Post("/reset-password", authHandler.ResetPassword)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)
	auth.Post("/logout-all", middleware.AuthProtected(s.JWTService), authHandler.LogoutAll)

	email := s.App.Group("/email")
	email.Post("/inbound", emailHandler.Inbound)
	email.Post("/webhook", emailHandler.Inbound)

	users := s.App.Group("/users", middleware.AuthProtected(s.JWTService))
	users.Get("/me", userHandler.GetMe)
	users.Put("/me", userHandler.UpdateMe)

	email.Get("/inbox", middleware.AuthProtected(s.JWTService), emailHandler.Inbox)

	integrations := s.App.Group("/integrations", middleware.AuthProtected(s.JWTService))
	integrations.Get("/status", integrationHandler.Status)
	integrations.Get("/google/connect", integrationHandler.GoogleConnect)
	integrations.Post("/google/disconnect", integrationHandler.GoogleDisconnect)
	s.App.Get("/integrations/google/callback", integrationHandler.GoogleCallback)

	receipts := s.App.Group("/receipts", middleware.AuthProtected(s.JWTService))
	receipts.Post("/upload", middleware.RateLimit(s.Redis.Client, "upload", 10, 1*time.Minute), receiptHandler.Upload)
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

	accountant := s.App.Group("/accountant", middleware.AuthProtected(s.JWTService))
	accountant.Get("/clients", accountantHandler.ListClients)
	accountant.Get("/review-queue", accountantHandler.ReviewQueue)

	bank := s.App.Group("/bank", middleware.AuthProtected(s.JWTService))
	bank.Post("/imports", bankHandler.ImportCSV)
	bank.Get("/transactions", bankHandler.ListTransactions)

	s.App.Get("/dashboard", middleware.AuthProtected(s.JWTService), dashboardHandler.GetStats)
	s.App.Get("/onboarding/status", middleware.AuthProtected(s.JWTService), onboardingHandler.Status)

	s.App.Get("/billing/status", middleware.AuthProtected(s.JWTService), billingHandler.GetStatus)
	s.App.Get("/billing/plans", billingHandler.GetPlans)
	s.App.Post("/billing/checkout", middleware.AuthProtected(s.JWTService), billingHandler.CreateCheckout)
	s.App.Post("/billing/webhook", billingHandler.StripeWebhook)
	s.App.Post("/checkout", billingHandler.CreateCheckout)

	s.App.Get("/metrics", metricsHandler.GetMetrics)
	s.App.Get("/ops/health", middleware.AuthProtected(s.JWTService), opsHandler.Health)
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
