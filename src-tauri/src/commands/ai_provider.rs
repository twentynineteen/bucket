// AI Provider Command Handlers
// Feature: 006-i-wish-to
// Purpose: Generic provider connection validation (not Ollama-specific)

use serde::{Deserialize, Serialize};
use tauri::command;

// ============================================================================
// Type Definitions
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub message: Option<String>,
    pub latency_ms: Option<u64>,
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Validate AI provider connection (generic HTTP health check)
 * FR-009: Settings page configuration
 * FR-024: Provider connectivity validation
 * FR-025: Error handling for unavailable providers
 */
#[command]
pub async fn validate_provider_connection(
    provider_url: String,
    timeout_ms: Option<u64>,
) -> Result<ConnectionStatus, String> {
    let start = std::time::Instant::now();
    let timeout = timeout_ms.unwrap_or(5000);

    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Attempt to connect to provider
    match client.get(&provider_url).send().await {
        Ok(response) => {
            let latency = start.elapsed().as_millis() as u64;

            if response.status().is_success() {
                Ok(ConnectionStatus {
                    connected: true,
                    message: Some(format!("Connected successfully (HTTP {})", response.status())),
                    latency_ms: Some(latency),
                })
            } else {
                Ok(ConnectionStatus {
                    connected: false,
                    message: Some(format!(
                        "Connection failed: HTTP {} - {}",
                        response.status(),
                        response.status().canonical_reason().unwrap_or("Unknown")
                    )),
                    latency_ms: Some(latency),
                })
            }
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;

            let error_message = if e.is_timeout() {
                format!("Connection timeout after {}ms", timeout)
            } else if e.is_connect() {
                "Failed to connect to provider. Is the service running?".to_string()
            } else {
                format!("Connection error: {}", e)
            };

            Ok(ConnectionStatus {
                connected: false,
                message: Some(error_message),
                latency_ms: Some(latency),
            })
        }
    }
}

/**
 * Test provider availability with custom headers
 */
#[command]
pub async fn validate_provider_with_auth(
    provider_url: String,
    auth_header: String,
    timeout_ms: Option<u64>,
) -> Result<ConnectionStatus, String> {
    let start = std::time::Instant::now();
    let timeout = timeout_ms.unwrap_or(5000);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    match client
        .get(&provider_url)
        .header("Authorization", auth_header)
        .send()
        .await
    {
        Ok(response) => {
            let latency = start.elapsed().as_millis() as u64;

            Ok(ConnectionStatus {
                connected: response.status().is_success(),
                message: Some(format!("HTTP {}", response.status())),
                latency_ms: Some(latency),
            })
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;

            Ok(ConnectionStatus {
                connected: false,
                message: Some(format!("Connection error: {}", e)),
                latency_ms: Some(latency),
            })
        }
    }
}
