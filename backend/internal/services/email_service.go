package services

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
)

type EmailService struct {
	Config *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{Config: cfg}
}

func (s *EmailService) sendEmail(to string, subject, body string) error {
	if s.Config.SMTPHost == "" || s.Config.SMTPUser == "" || s.Config.SMTPPass == "" {
		log.Warn().Str("to", to).Str("subject", subject).Msg("SMTP not configured, skipping email sending")
		return nil
	}

	from := s.Config.SMTPFrom
	if from == "" {
		from = s.Config.SMTPUser
	}

	auth := smtp.PlainAuth("", s.Config.SMTPUser, s.Config.SMTPPass, s.Config.SMTPHost)
	
	msg := fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n"+
		"%s\r\n", from, to, subject, body)

	addr := fmt.Sprintf("%s:%d", s.Config.SMTPHost, s.Config.SMTPPort)

	// Port 465 is for implicit SSL/TLS.
	// Port 587 is for STARTTLS (standard).
	if s.Config.SMTPPort == 465 {
		return s.sendEmailWithTLS(addr, from, to, msg, auth)
	}

	// Standard smtp.SendMail for port 587 or 25
	err := smtp.SendMail(addr, auth, s.Config.SMTPUser, []string{to}, []byte(msg))
	if err != nil {
		log.Error().Err(err).Str("to", to).Msg("Failed to send email via standard SMTP")
		if s.Config.IsDevelopment() {
			log.Warn().Str("to", to).Str("subject", subject).Msg("Continuing without SMTP delivery in development")
			return nil
		}
		return err
	}

	log.Info().Str("to", to).Msg("Email sent successfully via SMTP")
	return nil
}

func (s *EmailService) sendEmailWithTLS(addr, from, to, msg string, auth smtp.Auth) error {
	host, _, _ := net.SplitHostPort(addr)
	
	// Connect to the SMTP Server
	conn, err := tls.Dial("tcp", addr, &tls.Config{
		InsecureSkipVerify: false, // Set to true only if you have self-signed certs
		ServerName:         host,
	})
	if err != nil {
		return fmt.Errorf("tls dial failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client creation failed: %w", err)
	}
	defer client.Quit()

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err = client.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth failed: %w", err)
			}
		}
	}

	if err = client.Mail(from); err != nil {
		return err
	}
	if err = client.Rcpt(to); err != nil {
		return err
	}

	w, err := client.Data()
	if err != nil {
		return err
	}

	_, err = w.Write([]byte(msg))
	if err != nil {
		return err
	}

	err = w.Close()
	if err != nil {
		return err
	}

	return nil
}

func (s *EmailService) SendVerificationEmail(email, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.Config.AppURL, token)
	log.Info().Str("email", email).Str("verify_url", verifyURL).Msg("Prepared verification email")
	
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
	log.Info().Str("email", email).Str("reset_url", resetURL).Msg("Prepared password reset email")
	
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
