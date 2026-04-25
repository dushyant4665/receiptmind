package services

import (
	"context"
	"testing"
)

func TestNewStorageServiceAcceptsSecretKeyAliases(t *testing.T) {
	t.Setenv("SUPABASE_URL", "https://example.supabase.co")
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "")
	t.Setenv("SUPABASE_SECRET_KEY", "secret-key-from-new-dashboard")

	service, err := NewStorageService(context.Background())
	if err != nil {
		t.Fatalf("expected storage service to accept SUPABASE_SECRET_KEY alias, got error: %v", err)
	}
	if service.serviceRoleKey != "secret-key-from-new-dashboard" {
		t.Fatalf("expected aliased secret key to be used")
	}
}
