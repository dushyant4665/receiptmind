package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		fmt.Println("Error: GEMINI_API_KEY not found in .env")
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	models := []string{"gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"}

	for _, model := range models {
		fmt.Printf("\n--- Testing Model: %s ---\n", model)
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

		reqBody := map[string]interface{}{
			"contents": []map[string]interface{}{
				{
					"parts": []map[string]interface{}{
						{"text": "Hello, respond with ONLY the word SUCCESS if you are working."},
					},
				},
			},
		}

		jsonBody, _ := json.Marshal(reqBody)
		resp, err := client.Post(url, "application/json", bytes.NewReader(jsonBody))
		if err != nil {
			fmt.Printf("Request failed for %s: %v\n", model, err)
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != 200 {
			fmt.Printf("Error %d for %s: %s\n", resp.StatusCode, model, string(body))
		} else {
			fmt.Printf("SUCCESS! Response from %s: %s\n", model, string(body))
		}
	}
}
