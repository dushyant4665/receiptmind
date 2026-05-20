package services

import (
	"fmt"
	"net/smtp"
	"receiptmind-backend/internal/config"
	"github.com/rs/zerolog/log"
)

type EmailService struct {
	Config *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{Config: cfg}
}

func (s *EmailService) sendEmail(to string, subject, body string) error {
	if s.Config.SMTPHost == "" || s.Config.SMTPUser == "" || s.Config.SMTPPass == "" {
		log.Warn().Msg("SMTP not configured, skipping email sending")
		return nil
	}

	auth := smtp.PlainAuth("", s.Config.SMTPUser, s.Config.SMTPPass, s.Config.SMTPHost)
	
	msg := []byte(fmt.Sprintf("To: %s\r\n"+
		"Subject: %s\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n"+
		"%s\r\n", to, subject, body))

	addr := fmt.Sprintf("%s:%d", s.Config.SMTPHost, s.Config.SMTPPort)
	err := smtp.SendMail(addr, auth, s.Config.SMTPUser, []string{to}, msg)
	if err != nil {
		log.Error().Err(err).Str("to", to).Msg("Failed to send email")
		return err
	}

	log.Info().Str("to", to).Msg("Email sent successfully")
	return nil
}

func (s *EmailService) SendVerificationEmail(email, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.Config.AppURL, token)
	
	subject := "Verify your ReceiptMind account"
	body := fmt.Sprintf(`
		<h1>Welcome to ReceiptMind</h1>
		<p>Please click the link below to verify your email address and activate your account:</p>
		<p><a href="%s">%s</a></p>
		<p>If you did not sign up for an account, you can safely ignore this email.</p>
		<br/>
		<p>Best regards,<br/>The ReceiptMind Team</p>
	`, verifyURL, verifyURL)

	return s.sendEmail(email, subject, body)
}

func (s *EmailService) SendPasswordResetEmail(email, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.Config.AppURL, token)
	
	subject := "Reset your ReceiptMind password"
	body := fmt.Sprintf(`
		<h1>Password Reset Request</h1>
		<p>We received a request to reset your password. Click the link below to set a new password:</p>
		<p><a href="%s">%s</a></p>
		<p>If you did not request a password reset, please ignore this email.</p>
		<br/>
		<p>Best regards,<br/>The ReceiptMind Team</p>
	`, resetURL, resetURL)

	return s.sendEmail(email, subject, body)
}

