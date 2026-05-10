package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"receiptmind-backend/internal/database"
)

type AuditService struct {
	db *database.Database
}

func NewAuditService(db *database.Database) *AuditService {
	return &AuditService{db: db}
}

func (s *AuditService) Log(ctx context.Context, orgID, userID, action, entityType, entityID, ipAddress, userAgent string, metadata string) {
	if metadata == "" {
		metadata = "{}"
	}
	_, err := s.db.Pool.Exec(ctx,
		`INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
		 VALUES ($1, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $5, $6, $7, $8, COALESCE($9::jsonb, '{}'::jsonb))`,
		uuid.NewString(), orgID, userID, action, entityType, entityID, ipAddress, userAgent, metadata,
	)
	if err != nil {
		log.Error().Err(err).Str("action", action).Str("entity_type", entityType).Msg("Failed to write audit log")
	}
}
