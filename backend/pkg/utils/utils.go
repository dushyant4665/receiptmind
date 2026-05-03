package utils

import (
	"regexp"
	"strings"
)

func GenerateSlug(s string) string {
	s = strings.ToLower(s)
	s = regexp.MustCompile(`[^a-z0-9\s-]`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`\s+`).ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
