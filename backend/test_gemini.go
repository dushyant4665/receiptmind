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
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=%s", apiKey)

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": "Hello, are you working? Respond with 'YES' if you are."},
				},
			},
		},
	}

	jsonBody, _ := json.Marshal(reqBody)

	fmt.Println("Testing Gemini API with gemini-flash-latest...")
	resp, err := client.Post(url, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		fmt.Printf("Request failed: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		fmt.Printf("Error %d: %s\n", resp.StatusCode, string(body))
	} else {
		fmt.Printf("Success! Response: %s\n", string(body))
	}
}
