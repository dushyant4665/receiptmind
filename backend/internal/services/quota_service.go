package services

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/database"
)

type QuotaService struct {
	db       *database.Database
	cfg      *config.Config
	emailSvc *EmailService
}

func NewQuotaService(db *database.Database, cfg *config.Config, emailSvc *EmailService) *QuotaService {
	return &QuotaService{db: db, cfg: cfg, emailSvc: emailSvc}
}

func quotaMonth(t time.Time) string {
	return t.UTC().Format("2006-01")
}

func (s *QuotaService) FreeLimit() int {
	if s.cfg.FreePlanReceiptLimit > 0 {
		return s.cfg.FreePlanReceiptLimit
	}
	return 10
}

func (s *QuotaService) CanProcess(ctx context.Context, orgID string) (bool, int, int) {
	limit := s.FreeLimit()
	if s.hasUnlimitedPlan(ctx, orgID) {
		return true, s.currentUsage(ctx, orgID), 0
	}
	count := s.currentUsage(ctx, orgID)
	return count < limit, count, limit
}

func (s *QuotaService) currentUsage(ctx context.Context, orgID string) int {
	var count int
	_ = s.db.Pool.QueryRow(ctx,
		`SELECT receipts_processed FROM usage_tracking WHERE organization_id = $1 AND month = $2`,
		orgID, quotaMonth(time.Now()),
	).Scan(&count)
	return count
}

func (s *QuotaService) hasUnlimitedPlan(ctx context.Context, orgID string) bool {
	var plan string
	var active bool
	_ = s.db.Pool.QueryRow(ctx,
		`SELECT plan, status IN ('active', 'trialing')
		 FROM subscriptions
		 WHERE organization_id = $1 AND deleted_at IS NULL
		 ORDER BY updated_at DESC
		 LIMIT 1`,
		orgID,
	).Scan(&plan, &active)
	return active && plan != "" && plan != "free"
}

func (s *QuotaService) IncrementProcessed(ctx context.Context, orgID string) {
	month := quotaMonth(time.Now())
	_, err := s.db.Pool.Exec(ctx,
		`INSERT INTO usage_tracking (organization_id, month, receipts_processed, updated_at)
		 VALUES ($1, $2, 1, NOW())
		 ON CONFLICT (organization_id, month)
		 DO UPDATE SET receipts_processed = usage_tracking.receipts_processed + 1, updated_at = NOW()`,
		orgID, month,
	)
	if err != nil {
		log.Error().Err(err).Str("org_id", orgID).Msg("Failed to increment usage")
		return
	}
	s.sendThresholdEmails(ctx, orgID, month)
}

func (s *QuotaService) sendThresholdEmails(ctx context.Context, orgID, month string) {
	if s.hasUnlimitedPlan(ctx, orgID) {
		return
	}
	limit := s.FreeLimit()
	var count int
	var email string
	var warningSent, exhaustedSent *time.Time
	err := s.db.Pool.QueryRow(ctx,
		`SELECT ut.receipts_processed, u.email, ut.quota_warning_80_sent_at, ut.quota_exhausted_sent_at
		 FROM usage_tracking ut
		 JOIN users u ON u.organization_id = ut.organization_id
		 WHERE ut.organization_id = $1 AND ut.month = $2
		 ORDER BY u.created_at ASC LIMIT 1`,
		orgID, month,
	).Scan(&count, &email, &warningSent, &exhaustedSent)
	if err != nil {
		log.Error().Err(err).Str("org_id", orgID).Msg("Failed to load quota email target")
		return
	}

	if count >= limit && exhaustedSent == nil {
		if err := s.emailSvc.SendQuotaExhausted(ctx, email); err != nil {
			log.Error().Err(err).Msg("Failed to send quota exhausted email")
		}
		_, _ = s.db.Pool.Exec(ctx, `UPDATE usage_tracking SET quota_exhausted_sent_at = NOW() WHERE organization_id = $1 AND month = $2`, orgID, month)
		return
	}

	threshold := int(float64(limit) * 0.8)
	if threshold < 1 {
		threshold = 1
	}
	if count >= threshold && warningSent == nil {
		remaining := limit - count
		if remaining < 0 {
			remaining = 0
		}
		if err := s.emailSvc.SendQuotaWarning(ctx, email, remaining); err != nil {
			log.Error().Err(err).Msg("Failed to send quota warning email")
		}
		_, _ = s.db.Pool.Exec(ctx, `UPDATE usage_tracking SET quota_warning_80_sent_at = NOW() WHERE organization_id = $1 AND month = $2`, orgID, month)
	}
}

func (s *QuotaService) BlockMessage(count, limit int) string {
	return fmt.Sprintf("quota_reached: %d/%d receipts used this month. Upgrade to continue automation.", count, limit)
}
