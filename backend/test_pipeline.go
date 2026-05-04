package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"receiptmind-backend/internal/config"
	"receiptmind-backend/internal/services"
)

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Warning: .env file not found")
	}

	cfg := config.Load()
	
	// Create the pipeline
	pipeline := services.NewExtractionPipeline(cfg)

	// Use one of the existing PDF files for testing
	testFile := `c:\Users\Lenovo\OneDrive\Desktop\bookkeeper\receiptmind-enterprise\backend\uploads\174fb376-50b3-4502-a07e-be87379c74b4\2e018081-bc2c-4e3c-99c3-7eaf7c354142.pdf`
	
	data, err := os.ReadFile(testFile)
	if err != nil {
		fmt.Printf("Error reading test file: %v\n", err)
		return
	}

	fmt.Printf("Testing pipeline with file: %s (Size: %d bytes)\n", filepath.Base(testFile), len(data))

	ctx := context.Background()
	result, err := pipeline.Process(ctx, data, filepath.Base(testFile))
	if err != nil {
		fmt.Printf("Pipeline processing failed: %v\n", err)
		return
	}

	// Print the result in a pretty format
	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println("\n--- Extraction Result ---")
	fmt.Println(string(output))
	fmt.Println("-------------------------")
	
	if result.Confidence > 0.6 {
		fmt.Println("✅ TEST SUCCESS: Data extracted with good confidence.")
	} else {
		fmt.Println("⚠️ TEST WARNING: Extraction succeeded but confidence is low.")
	}
}
