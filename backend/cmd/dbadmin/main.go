package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5"
)

func main() {
	if len(os.Args) < 2 {
		fatal("usage: dbadmin <reset|schema|pending-token|show-user|show-pending>")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fatal("DATABASE_URL is required")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		fatalf("connect failed: %v", err)
	}
	defer conn.Close(ctx)

	switch os.Args[1] {
	case "reset":
		mustExec(ctx, conn, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
		fmt.Println("database reset complete")
	case "schema":
		schemaPath := filepath.Join("db", "schema.sql")
		data, err := os.ReadFile(schemaPath)
		if err != nil {
			fatalf("read schema failed: %v", err)
		}
		for _, stmt := range strings.Split(string(data), ";") {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			mustExec(ctx, conn, stmt)
		}
		fmt.Println("schema apply complete")
	case "pending-token":
		if len(os.Args) < 4 {
			fatal("usage: dbadmin pending-token <email> <plain-token>")
		}
		hash := sha256.Sum256([]byte(os.Args[3]))
		tokenHash := hex.EncodeToString(hash[:])
		tag, err := conn.Exec(ctx, `UPDATE pending_registrations SET token_hash = $1 WHERE email = $2`, tokenHash, os.Args[2])
		if err != nil {
			fatalf("update token failed: %v", err)
		}
		fmt.Printf("pending-token updated rows=%d\n", tag.RowsAffected())
	case "show-user":
		if len(os.Args) < 3 {
			fatal("usage: dbadmin show-user <email>")
		}
		var id, email, status string
		err := conn.QueryRow(ctx, `SELECT id, email, status FROM users WHERE email = $1`, os.Args[2]).Scan(&id, &email, &status)
		if err != nil {
			fatalf("show-user failed: %v", err)
		}
		fmt.Printf("id=%s email=%s status=%s\n", id, email, status)
	case "show-pending":
		if len(os.Args) < 3 {
			fatal("usage: dbadmin show-pending <email>")
		}
		var email, orgName, tokenHash string
		err := conn.QueryRow(ctx, `SELECT email, organization_name, token_hash FROM pending_registrations WHERE email = $1`, os.Args[2]).Scan(&email, &orgName, &tokenHash)
		if err != nil {
			fatalf("show-pending failed: %v", err)
		}
		fmt.Printf("email=%s organization_name=%s token_hash=%s\n", email, orgName, tokenHash)
	default:
		fatal("unknown command")
	}
}

func mustExec(ctx context.Context, conn *pgx.Conn, sql string) {
	if _, err := conn.Exec(ctx, sql); err != nil {
		fatalf("sql failed: %v\nstatement: %s", err, sql)
	}
}

func fatal(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}

func fatalf(format string, args ...interface{}) {
	fatal(fmt.Sprintf(format, args...))
}
