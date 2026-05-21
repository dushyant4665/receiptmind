package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
)

func main() {
	dbURL := "postgresql://neondb_owner:npg_p5tIvQLFqol2@ep-blue-forest-ao3krz3d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
	
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		fmt.Printf("Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	query := `
	CREATE TABLE IF NOT EXISTS pending_registrations (
		id UUID PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		organization_name TEXT NOT NULL,
		token_hash TEXT NOT NULL UNIQUE,
		expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_pending_registrations_token ON pending_registrations(token_hash);
	CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
	`

	_, err = conn.Exec(ctx, query)
	if err != nil {
		fmt.Printf("Failed to create table: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Table pending_registrations created successfully.")
}


