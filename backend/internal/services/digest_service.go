package services

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
)

type DigestService struct {
	db       *database.Database
	emailSvc *EmailService
}

func NewDigestService(db *database.Database, emailSvc *EmailService) *DigestService {
	return &DigestService{db: db, emailSvc: emailSvc}
}

func (s *DigestService) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.SendDueDigests(ctx)
		}
	}
}

func (s *DigestService) SendDueDigests(ctx context.Context) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT o.id, u.email
		 FROM organizations o
		 JOIN users u ON u.organization_id = o.id
		 WHERE u.status = 'active' AND u.email_verified_at IS NOT NULL
		 ORDER BY u.created_at ASC`,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to load digest organizations")
		return
	}
	defer rows.Close()

	today := time.Now().UTC().Format("2006-01-02")
	for rows.Next() {
		var orgID, email string
		if err := rows.Scan(&orgID, &email); err != nil {
			continue
		}
		var alreadySent int
		_ = s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM daily_digest_runs WHERE organization_id = $1 AND digest_date = $2`, orgID, today).Scan(&alreadySent)
		if alreadySent > 0 {
			continue
		}

		var processed, exceptions int
		var total float64
		_ = s.db.Pool.QueryRow(ctx,
			`SELECT COUNT(*), COALESCE(SUM(amount), 0)
			 FROM receipts
			 WHERE organization_id = $1 AND status = 'processed' AND created_at >= CURRENT_DATE`,
			orgID,
		).Scan(&processed, &total)
		_ = s.db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM exceptions WHERE organization_id = $1 AND status = 'open'`,
			orgID,
		).Scan(&exceptions)

		if processed == 0 && exceptions == 0 {
			continue
		}
		if err := s.emailSvc.SendDailyDigest(ctx, email, processed, total, exceptions); err != nil {
			log.Error().Err(err).Str("org_id", orgID).Msg("Failed to send digest")
			continue
		}
		_, _ = s.db.Pool.Exec(ctx, `INSERT INTO daily_digest_runs (organization_id, digest_date) VALUES ($1, $2) ON CONFLICT DO NOTHING`, orgID, today)
	}
}
