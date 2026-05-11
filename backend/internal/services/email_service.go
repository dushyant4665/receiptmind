package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
)

type EmailService struct {
	cfg    *config.Config
	client *http.Client
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second}}
}

func (s *EmailService) SendVerification(ctx context.Context, to, link string) error {
	return s.send(ctx, to, "Verify your ReceiptMind account", premiumEmail("Verify your email", "Your bookkeeping automation is almost ready. Confirm this email to activate your secure workspace.", "Verify Email", link))
}

func (s *EmailService) SendWelcome(ctx context.Context, to, dashboardURL string) error {
	return s.send(ctx, to, "Welcome to ReceiptMind", premiumEmail("Your workspace is ready", "Forward receipts or upload files. ReceiptMind will extract, categorize, and prepare your books automatically.", "Open Dashboard", dashboardURL))
}

func (s *EmailService) SendPasswordReset(ctx context.Context, to, link string) error {
	return s.send(ctx, to, "Reset your ReceiptMind password", premiumEmail("Reset your password", "Use this secure link within 15 minutes. If you did not request this, you can ignore this email.", "Reset Password", link))
}

func (s *EmailService) SendQuotaWarning(ctx context.Context, to string, remaining int) error {
	body := premiumEmail("Your free automation is almost full", fmt.Sprintf("You have %d receipt uploads remaining this month. Upgrade before automation pauses.", remaining), "Upgrade", s.cfg.AppURL+"/settings/billing")
	return s.send(ctx, to, "ReceiptMind quota warning", body)
}

func (s *EmailService) SendQuotaExhausted(ctx context.Context, to string) error {
	body := premiumEmail("Your bookkeeping automation has paused", "Your free monthly receipt quota is used. Upgrade to continue automatic processing, email forwarding, and exports.", "Upgrade to Continue", s.cfg.AppURL+"/settings/billing")
	return s.send(ctx, to, "ReceiptMind automation paused", body)
}

func (s *EmailService) SendDailyDigest(ctx context.Context, to string, processed int, total float64, exceptions int) error {
	minutesSaved := processed * 5
	body := premiumEmail("Your books updated today", fmt.Sprintf("%d receipts processed, %.2f categorized, %d items need review. About %d minutes of manual work avoided.", processed, total, exceptions, minutesSaved), "Review only what matters", s.cfg.AppURL+"/exceptions")
	return s.send(ctx, to, "ReceiptMind daily summary", body)
}

func (s *EmailService) send(ctx context.Context, to, subject, htmlBody string) error {
	if s.cfg.ResendAPIKey == "" {
		log.Info().Str("to", to).Str("subject", subject).Msg("Email skipped: RESEND_API_KEY not configured")
		return nil
	}

	payload := map[string]interface{}{
		"from":    s.cfg.EmailFrom,
		"to":      []string{to},
		"subject": subject,
		"html":    htmlBody,
	}
	data, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend error %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func premiumEmail(title, message, cta, link string) string {
	return fmt.Sprintf(`<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Inter,Arial,sans-serif;color:#171717;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e2d8;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 28px 8px;"><div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b7791f;">ReceiptMind</div>
<h1 style="margin:18px 0 8px;font-size:26px;line-height:1.15;color:#171717;">%s</h1>
<p style="margin:0;color:#555;line-height:1.6;font-size:15px;">%s</p></td></tr>
<tr><td style="padding:24px 28px;"><a href="%s" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">%s</a></td></tr>
<tr><td style="padding:0 28px 28px;color:#777;font-size:12px;line-height:1.5;">This link is private and time-limited. ReceiptMind keeps your bookkeeping organized automatically.</td></tr>
</table></td></tr></table></body></html>`, html.EscapeString(title), html.EscapeString(message), html.EscapeString(link), html.EscapeString(cta))
}
