package services

import (
	"fmt"
	"receiptmind-backend/internal/config"
	"github.com/rs/zerolog/log"
)

type EmailService struct {
	Config *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{Config: cfg}
}

func (s *EmailService) SendVerificationEmail(email, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.Config.AppURL, token)
	
	// In a real application, you would send an actual email here.
	// For now, we'll log it to the console so the developer can see the link.
	log.Info().
		Str("to", email).
		Str("url", verifyURL).
		Msg("Verification email 'sent' (simulation)")
	
	return nil
}

func (s *EmailService) SendPasswordResetEmail(email, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.Config.AppURL, token)
	
	log.Info().
		Str("to", email).
		Str("url", resetURL).
		Msg("Password reset email 'sent' (simulation)")
	
	return nil
}
