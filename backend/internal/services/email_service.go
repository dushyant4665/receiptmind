package services

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"net/textproto"
	"strings"
	"time"

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
		return fmt.Errorf("SMTP is not configured")
	}

	fromHeader := s.Config.SMTPFrom
	if fromHeader == "" {
		fromHeader = s.Config.SMTPUser
	}
	envelopeFrom := extractEmailAddress(fromHeader)
	if envelopeFrom == "" {
		envelopeFrom = s.Config.SMTPUser
	}

	auth := smtp.PlainAuth("", s.Config.SMTPUser, s.Config.SMTPPass, s.Config.SMTPHost)
	
	msg := fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n"+
		"%s\r\n", fromHeader, to, subject, body)

	addr := fmt.Sprintf("%s:%d", s.Config.SMTPHost, s.Config.SMTPPort)

	// Port 465 is for implicit SSL/TLS.
	// Port 587 is for STARTTLS (standard).
	if s.Config.SMTPPort == 465 {
		return s.sendWithTimeout(func() error {
			return s.sendEmailWithTLS(addr, envelopeFrom, to, msg, auth)
		})
	}

	err := s.sendWithTimeout(func() error {
		return s.sendEmailWithStartTLS(addr, envelopeFrom, to, msg, auth)
	})
	if err != nil {
		log.Error().Err(err).Str("to", to).Msg("Failed to send email via STARTTLS SMTP")
		return err
	}

	log.Info().Str("to", to).Msg("Email sent successfully via SMTP")
	return nil
}

func (s *EmailService) sendWithTimeout(fn func() error) error {
	result := make(chan error, 1)
	go func() {
		result <- fn()
	}()

	timeout := 12 * time.Second
	select {
	case err := <-result:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("email send timed out after %s", timeout)
	}
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

func (s *EmailService) sendEmailWithStartTLS(addr, from, to, msg string, auth smtp.Auth) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("split host/port failed: %w", err)
	}

	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("smtp dial failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client creation failed: %w", err)
	}
	defer client.Quit()

	if ok, _ := client.Extension("STARTTLS"); !ok {
		return fmt.Errorf("smtp server does not support STARTTLS")
	}

	tlsConfig := &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	}
	if err := client.StartTLS(tlsConfig); err != nil {
		return fmt.Errorf("starttls failed: %w", err)
	}

	if ok, _ := client.Extension("AUTH"); ok {
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth failed: %w", err)
		}
	}

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("mail from failed: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("rcpt to failed: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("data command failed: %w", err)
	}
	if _, err := writer.Write([]byte(msg)); err != nil {
		return fmt.Errorf("message write failed: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("message close failed: %w", err)
	}

	return nil
}

func extractEmailAddress(value string) string {
	addr, err := textproto.TrimString(value), error(nil)
	_ = err
	if strings.Contains(addr, "<") && strings.Contains(addr, ">") {
		start := strings.Index(addr, "<")
		end := strings.LastIndex(addr, ">")
		if start >= 0 && end > start {
			return strings.TrimSpace(addr[start+1 : end])
		}
	}
	return strings.TrimSpace(addr)
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
