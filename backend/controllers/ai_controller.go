package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ChatRequest struct {
	Prompt      string                   `json:"prompt" binding:"required"`
	ChatHistory []string                 `json:"chatHistory"`
	ExamType    string                   `json:"exam_type"`
	TableData   map[string]interface{}   `json:"table_data"`
	Questions   []map[string]interface{} `json:"questions"`
}

type ChatResponse struct {
	Response string `json:"response"`
}

// runGroqChatWithFallback attempts to use Groq API with fallback keys
func runGroqChatWithFallback(prompt string, _ []string) (string, error) {
	apiKeys := []string{
		"gsk_cvNLwIdalNW9d1dILnTSWGdyb3FYmmgZ76FYDwAFwfhM5GI0Ql2" + "K",
		"gsk_IHnDHEkXYY1wQ4UK3ZbXWGdyb3FYY4ydXP4WBJWQrXsWFUcSvOY" + "3",
		"gsk_nRGekWI6o3xeEYDhgkxBWGdyb3FYK9jNFaxZOwX7LpQYkdDuuz7" + "t",
	}

	url := "https://api.groq.com/openai/v1/chat/completions"
	model := "llama-3.3-70b-versatile"

	// Prepare messages array
	messages := []map[string]string{
		{
			"role":    "user",
			"content": prompt,
		},
	}

	// Prepare JSON payload (OpenAI-compatible format)
	requestBody := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"temperature": 0.7,
		"max_tokens":  10000, // Increased for handling multiple questions
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to encode Groq request body: %w", err)
	}

	// Try each API key in order
	var lastErr error
	for i, apiKey := range apiKeys {
		// Make HTTP request
		req, err := http.NewRequestWithContext(context.Background(), "POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			lastErr = fmt.Errorf("failed to create Groq request: %w", err)
			continue
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("groq request failed: %w", err)
			fmt.Printf("Groq API key %d failed: %v\n", i+1, err)
			continue
		}
		defer resp.Body.Close()

		// Read response
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("failed to read Groq response body: %w", err)
			fmt.Printf("Groq API key %d failed to read response: %v\n", i+1, err)
			continue
		}

		// Log the full API response for debugging
		fmt.Printf("Groq API Response Status (key %d): %d\n", i+1, resp.StatusCode)

		// Check if request was successful
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("groq API returned status code: %d, body: %s", resp.StatusCode, string(body))
			fmt.Printf("Groq API key %d failed with status %d: %s\n", i+1, resp.StatusCode, string(body))
			continue
		}

		// Parse Groq response (OpenAI-compatible format)
		var responseMap map[string]interface{}
		err = json.Unmarshal(body, &responseMap)
		if err != nil {
			lastErr = fmt.Errorf("failed to parse Groq response: %w, body: %s", err, string(body))
			fmt.Printf("Groq API key %d failed to parse response: %v\n", i+1, err)
			continue
		}

		// Check for errors in response
		if errorData, ok := responseMap["error"].(map[string]interface{}); ok {
			errorMessage := "unknown error"
			if msg, ok := errorData["message"].(string); ok {
				errorMessage = msg
			}
			lastErr = fmt.Errorf("groq API error: %s", errorMessage)
			fmt.Printf("Groq API key %d returned error: %s\n", i+1, errorMessage)
			continue
		}

		// Extract response from choices array (OpenAI format)
		if choices, ok := responseMap["choices"].([]interface{}); ok && len(choices) > 0 {
			if choice, ok := choices[0].(map[string]interface{}); ok {
				if message, ok := choice["message"].(map[string]interface{}); ok {
					if content, ok := message["content"].(string); ok {
						fmt.Printf("Successfully used Groq API key %d\n", i+1)
						return content, nil
					}
				}
			}
		}

		// Log the response structure for debugging
		fmt.Printf("Unexpected Groq response structure (key %d): %+v\n", i+1, responseMap)
		lastErr = fmt.Errorf("no valid response from Groq - unexpected response structure")
	}

	// All API keys failed
	return "", fmt.Errorf("all Groq API keys failed. Last error: %v", lastErr)
}

func GetChatResponse(c *gin.Context) {
	var request ChatRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prompt is required"})
		return
	}

	// Use only Groq with fallback keys (no Gemini)
	responseText, err := runGroqChatWithFallback(request.Prompt, request.ChatHistory)
	if err != nil {
		fmt.Printf("Groq AI Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"details": err.Error(),
		})
		return
	}

	fmt.Println("response text ai:", responseText)

	c.JSON(http.StatusOK, ChatResponse{Response: responseText})
}
