package models

import (
	"time"
)

type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type User struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	PasswordHash   string    `json:"-"`
	OrganizationID string    `json:"organization_id"`
	CreatedAt      time.Time `json:"created_at"`
}

type Session struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type AuthResponse struct {
	AccessToken    string       `json:"access_token"`
	RefreshToken   string       `json:"refresh_token"`
	User           UserResponse `json:"user"`
	OrganizationID string       `json:"organization_id"`
}

type UserResponse struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	OrganizationID string    `json:"organization_id"`
	CreatedAt      time.Time `json:"created_at"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:             u.ID,
		Email:          u.Email,
		Name:           u.Name,
		OrganizationID: u.OrganizationID,
		CreatedAt:      u.CreatedAt,
	}
}
