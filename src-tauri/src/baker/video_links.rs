//! Video link and Trello card commands. Each is a thin adapter over the
//! breadcrumbs module (#303), where the rules live. PR 2 of #303 moves the
//! frontend to `breadcrumbs_apply` and deletes these.

use app_lib::breadcrumbs::{Breadcrumbs, Change};
use app_lib::media::{TrelloBoard, TrelloCard, VideoLink};

use super::legacy::{apply_legacy, off_thread, read_legacy};

/// Extract Trello card ID from URL
fn extract_trello_card_id(url: &str) -> Option<String> {
    let re = regex::Regex::new(r"trello\.com/c/([a-zA-Z0-9]{8,24})").ok()?;
    re.captures(url)?.get(1).map(|m| m.as_str().to_string())
}

#[tauri::command]
pub async fn baker_get_video_links(project_path: String) -> Result<Vec<VideoLink>, String> {
    off_thread(move || {
        Ok(read_legacy(&project_path)?
            .map(|b| b.video_links)
            .unwrap_or_default())
    })
    .await
}

#[tauri::command]
pub async fn baker_associate_video_link(
    project_path: String,
    video_link: VideoLink,
) -> Result<Breadcrumbs, String> {
    off_thread(move || apply_legacy(&project_path, Change::AddVideoLink { link: video_link })).await
}

#[tauri::command]
pub async fn baker_remove_video_link(
    project_path: String,
    video_index: usize,
) -> Result<Breadcrumbs, String> {
    off_thread(move || {
        apply_legacy(
            &project_path,
            Change::RemoveVideoLink { index: video_index },
        )
    })
    .await
}

/// The old command carries no last-seen URL, so it supplies the current one.
/// The race guard takes effect once callers move to `breadcrumbs_apply`.
#[tauri::command]
pub async fn baker_update_video_link(
    project_path: String,
    video_index: usize,
    updated_link: VideoLink,
) -> Result<Breadcrumbs, String> {
    off_thread(move || {
        let current = read_legacy(&project_path)?.ok_or("No breadcrumbs file found")?;
        let expected_url = current
            .video_links
            .get(video_index)
            .map(|link| link.url.clone())
            .ok_or("Video index out of bounds")?;
        apply_legacy(
            &project_path,
            Change::UpdateVideoLink {
                index: video_index,
                expected_url,
                link: updated_link,
            },
        )
    })
    .await
}

#[tauri::command]
pub async fn baker_reorder_video_links(
    project_path: String,
    from_index: usize,
    to_index: usize,
) -> Result<Breadcrumbs, String> {
    off_thread(move || {
        apply_legacy(
            &project_path,
            Change::ReorderVideoLinks {
                from: from_index,
                to: to_index,
            },
        )
    })
    .await
}

#[tauri::command]
pub async fn baker_get_trello_cards(project_path: String) -> Result<Vec<TrelloCard>, String> {
    off_thread(move || {
        Ok(read_legacy(&project_path)?
            .map(|b| b.trello_cards)
            .unwrap_or_default())
    })
    .await
}

#[tauri::command]
pub async fn baker_associate_trello_card(
    project_path: String,
    trello_card: TrelloCard,
) -> Result<Breadcrumbs, String> {
    off_thread(move || apply_legacy(&project_path, Change::AddTrelloCard { card: trello_card }))
        .await
}

#[tauri::command]
pub async fn baker_remove_trello_card(
    project_path: String,
    card_index: usize,
) -> Result<Breadcrumbs, String> {
    off_thread(move || {
        let current = read_legacy(&project_path)?.ok_or("No breadcrumbs file found")?;
        let card_id = current
            .trello_cards
            .get(card_index)
            .map(|card| card.card_id.clone())
            .ok_or("Card index out of bounds")?;
        apply_legacy(&project_path, Change::RemoveTrelloCard { card_id })
    })
    .await
}

#[tauri::command]
pub async fn baker_fetch_trello_card_details(
    card_url: String,
    api_key: String,
    api_token: String,
) -> Result<TrelloCard, String> {
    let card_id = extract_trello_card_id(&card_url).ok_or("Invalid Trello card URL format")?;

    let client = reqwest::Client::new();
    let url = format!(
        "https://api.trello.com/1/cards/{}?key={}&token={}",
        card_id, api_key, api_token
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if response.status() == 401 {
        return Err("Unauthorized: Invalid API credentials".to_string());
    }

    if response.status() == 404 {
        return Err("Card not found".to_string());
    }

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    let board_name = if let Some(board_id) = data["idBoard"].as_str() {
        let board_url = format!(
            "https://api.trello.com/1/boards/{}?key={}&token={}&fields=name",
            board_id, api_key, api_token
        );

        match client.get(&board_url).send().await {
            Ok(board_response) if board_response.status().is_success() => board_response
                .json::<serde_json::Value>()
                .await
                .ok()
                .and_then(|board_data| board_data["name"].as_str().map(|s| s.to_string())),
            _ => None,
        }
    } else {
        None
    };

    Ok(TrelloCard {
        url: card_url,
        card_id,
        title: data["name"].as_str().unwrap_or("Unknown").to_string(),
        board_name,
        last_fetched: Some(chrono::Utc::now().to_rfc3339()),
    })
}

/// Fetch all boards the authenticated user is a member of
#[tauri::command]
pub async fn fetch_trello_boards(
    api_key: String,
    api_token: String,
) -> Result<Vec<TrelloBoard>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.trello.com/1/members/me/boards?key={}&token={}&fields=id,name,prefs&organization_fields=name",
        api_key, api_token
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if response.status() == 401 {
        return Err("Unauthorized: Invalid API credentials".to_string());
    }

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let boards: Vec<TrelloBoard> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    Ok(boards)
}
