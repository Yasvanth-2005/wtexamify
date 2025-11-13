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
	Prompt      string   `json:"prompt" binding:"required"`
	ChatHistory []string `json:"chatHistory"`
}

type ChatResponse struct {
	Response string `json:"response"`
}

// runGeminiChat attempts to use Gemini API
func runGeminiChat(prompt string, chatHistory []string) (string, error) {
	apiKey := "AIzaSyDkKH1JLBQpMJFOGkmFjzfN-_m8FbuxZM8"
	if apiKey == "" {
		return "", fmt.Errorf("gemini API key is missing")
	}

	model := "gemini-2.5-flash"
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	// Prepare JSON payload
	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role":  "user",
				"parts": []map[string]string{{"text": prompt}},
			},
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to encode request body: %w", err)
	}

	// Make HTTP request
	req, err := http.NewRequestWithContext(context.Background(), "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Log the full API response for debugging
	fmt.Println("Gemini API Response Status:", resp.StatusCode)

	// Check if request was successful
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini API returned status code: %d, body: %s", resp.StatusCode, string(body))
	}

	// Correct the response parsing
	var responseMap map[string]interface{}
	err = json.Unmarshal(body, &responseMap)
	if err != nil {
		return "", fmt.Errorf("failed to parse Gemini response: %w, body: %s", err, string(body))
	}

	// Check for errors in response
	if errorData, ok := responseMap["error"].(map[string]interface{}); ok {
		errorMessage := "unknown error"
		if msg, ok := errorData["message"].(string); ok {
			errorMessage = msg
		}
		return "", fmt.Errorf("gemini API error: %s", errorMessage)
	}

	// Check if 'candidates' exist in the response
	if candidates, ok := responseMap["candidates"].([]interface{}); ok && len(candidates) > 0 {
		if candidate, ok := candidates[0].(map[string]interface{}); ok {
			// Check for finishReason (might indicate blocked content)
			if finishReason, ok := candidate["finishReason"].(string); ok {
				if finishReason != "STOP" {
					return "", fmt.Errorf("gemini AI response blocked or incomplete, finishReason: %s", finishReason)
				}
			}
			
			if content, ok := candidate["content"].(map[string]interface{}); ok {
				if parts, ok := content["parts"].([]interface{}); ok && len(parts) > 0 {
					if text, ok := parts[0].(map[string]interface{})["text"].(string); ok {
						return text, nil
					}
				}
			}
		}
	}

	// Log the response structure for debugging
	fmt.Printf("Unexpected Gemini response structure: %+v\n", responseMap)
	return "", fmt.Errorf("no valid response from Gemini - unexpected response structure")
}

func runGroqChat(prompt string, chatHistory []string) (string, error) {
	apiKey := "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"

	url := "https://api.groq.com/openai/v1/chat/completions"
	model := "llama-3.1-70b-versatile"

	// Prepare messages array
	messages := []map[string]string{
		{
			"role":    "user",
			"content": prompt,
		},
	}

	// Prepare JSON payload (OpenAI-compatible format)
	requestBody := map[string]interface{}{
		"model":    model,
		"messages": messages,
		"temperature": 0.7,
		"max_tokens": 1024,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to encode Groq request body: %w", err)
	}

	// Make HTTP request
	req, err := http.NewRequestWithContext(context.Background(), "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create Groq request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("groq request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read Groq response body: %w", err)
	}

	// Log the full API response for debugging
	fmt.Println("Groq API Response Status:", resp.StatusCode)

	// Check if request was successful
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("groq API returned status code: %d, body: %s", resp.StatusCode, string(body))
	}

	// Parse Groq response (OpenAI-compatible format)
	var responseMap map[string]interface{}
	err = json.Unmarshal(body, &responseMap)
	if err != nil {
		return "", fmt.Errorf("failed to parse Groq response: %w, body: %s", err, string(body))
	}

	// Check for errors in response
	if errorData, ok := responseMap["error"].(map[string]interface{}); ok {
		errorMessage := "unknown error"
		if msg, ok := errorData["message"].(string); ok {
			errorMessage = msg
		}
		return "", fmt.Errorf("groq API error: %s", errorMessage)
	}

	// Extract response from choices array (OpenAI format)
	if choices, ok := responseMap["choices"].([]interface{}); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := choice["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					return content, nil
				}
			}
		}
	}

	// Log the response structure for debugging
	fmt.Printf("Unexpected Groq response structure: %+v\n", responseMap)
	return "", fmt.Errorf("no valid response from Groq - unexpected response structure")
}

// RunChat tries Gemini first, then falls back to Groq if Gemini fails
func RunChat(prompt string, chatHistory []string) (string, error) {
	// Try Gemini first
	response, err := runGeminiChat(prompt, chatHistory)
	if err == nil {
		fmt.Println("Successfully used Gemini API")
		return response, nil
	}

	// If Gemini fails, log the error and try Groq
	fmt.Printf("Gemini API failed: %v. Attempting Groq fallback...\n", err)
	
	groqResponse, groqErr := runGroqChat(prompt, chatHistory)
	if groqErr == nil {
		fmt.Println("Successfully used Groq API as fallback")
		return groqResponse, nil
	}

	// Both APIs failed
	return "", fmt.Errorf("both Gemini and Groq APIs failed. Gemini error: %v, Groq error: %v", err, groqErr)
}

func GetChatResponse(c *gin.Context) {
	var request ChatRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prompt is required"})
		return
	}

	responseText, err := RunChat(request.Prompt, request.ChatHistory)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
		return
	}

	fmt.Println("response text ai:", responseText)

	c.JSON(http.StatusOK, ChatResponse{Response: responseText})
}
