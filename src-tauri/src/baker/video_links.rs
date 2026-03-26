use std::fs;
use std::path::Path;

use app_lib::media::{TrelloBoard, TrelloCard, VideoLink};

use super::breadcrumbs::baker_read_breadcrumbs;
use super::types::BreadcrumbsFile;

/// Extract Trello card ID from URL
fn extract_trello_card_id(url: &str) -> Option<String> {
    let re = regex::Regex::new(r"trello\.com/c/([a-zA-Z0-9]{8,24})").ok()?;
    re.captures(url)?.get(1).map(|m| m.as_str().to_string())
}

/// Migrate legacy trelloCardUrl to trelloCards array
fn migrate_trello_card_url(breadcrumbs: &BreadcrumbsFile) -> Vec<TrelloCard> {
    if let Some(cards) = &breadcrumbs.trello_cards {
        if !cards.is_empty() {
            return cards.clone();
        }
    }

    if let Some(url) = &breadcrumbs.trello_card_url {
        if let Some(card_id) = extract_trello_card_id(url) {
            return vec![TrelloCard {
                url: url.clone(),
                card_id: card_id.clone(),
                title: format!("Card {}", card_id),
                board_name: None,
                last_fetched: None,
            }];
        }
    }

    Vec::new()
}

/// Ensure backward compatible write (updates trelloCardUrl field)
fn ensure_backward_compatible_write(breadcrumbs: &mut BreadcrumbsFile) {
    if let Some(cards) = &breadcrumbs.trello_cards {
        if !cards.is_empty() {
            breadcrumbs.trello_card_url = Some(cards[0].url.clone());
        } else {
            breadcrumbs.trello_card_url = None;
        }
    } else {
        breadcrumbs.trello_card_url = None;
    }
}

/// Write breadcrumbs file to disk
fn write_breadcrumbs_file(project_path: &str, breadcrumbs: &BreadcrumbsFile) -> Result<(), String> {
    let path = Path::new(project_path);
    let breadcrumbs_path = path.join("breadcrumbs.json");

    let json = serde_json::to_string_pretty(breadcrumbs)
        .map_err(|e| format!("Failed to serialize breadcrumbs: {}", e))?;

    fs::write(&breadcrumbs_path, json)
        .map_err(|e| format!("Failed to write breadcrumbs file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn baker_get_video_links(project_path: String) -> Result<Vec<VideoLink>, String> {
    let breadcrumbs = baker_read_breadcrumbs(project_path).await?;

    match breadcrumbs {
        Some(b) => Ok(b.video_links.unwrap_or_default()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn baker_associate_video_link(
    project_path: String,
    video_link: VideoLink,
) -> Result<BreadcrumbsFile, String> {
    let mut breadcrumbs = baker_read_breadcrumbs(project_path.clone())
        .await?
        .ok_or("No breadcrumbs file found")?;

    if breadcrumbs.video_links.is_none() {
        breadcrumbs.video_links = Some(Vec::new());
    }

    let videos = breadcrumbs.video_links.as_mut().unwrap();

    if videos.len() >= 20 {
        return Err("Maximum of 20 videos per project reached".to_string());
    }

    videos.push(video_link);
    breadcrumbs.last_modified = Some(chrono::Utc::now().to_rfc3339());
    write_breadcrumbs_file(&project_path, &breadcrumbs)?;

    Ok(breadcrumbs)
}

#[tauri::command]
pub async fn baker_remove_video_link(
    project_path: String,
    video_index: usize,
) -> Result<BreadcrumbsFile, String> {
    let mut breadcrumbs = baker_read_breadcrumbs(project_path.clone())
        .await?
        .ok_or("No breadcrumbs file found")?;

    let videos = breadcrumbs.video_links.as_mut().ok_or("No videos found")?;

    if video_index >= videos.len() {
        return Err("Video index out of bounds".to_string());
    }

    videos.remove(video_index);
    breadcrumbs.last_modified = Some(chrono::Utc::now().to_rfc3339());
    write_breadcrumbs_file(&project_path, &breadcrumbs)?;

    Ok(breadcrumbs)
}

#[tauri::command]
pub async fn baker_update_video_link(
    project_path: String,
    video_index: usize,
    updated_link: VideoLink,
) -> Result<BreadcrumbsFile, String> {
    let mut breadcrumbs = baker_read_breadcrumbs(project_path.clone())
        .await?
        .ok_or("No breadcrumbs file found")?;

    let videos = breadcrumbs.video_links.as_mut().ok_or("No videos found")?;

    if video_index >= videos.len() {
        return Err("Video index out of bounds".to_string());
    }

    videos[video_index] = updated_link;
    breadcrumbs.last_modified = Some(chrono::Utc::now().to_rfc3339());
    write_breadcrumbs_file(&project_path, &breadcrumbs)?;

    Ok(breadcrumbs)
}

#[tauri::command]
pub async fn baker_reorder_video_links(
    project_path: String,
    from_index: usize,
    to_index: usize,
) -> Result<BreadcrumbsFile, String> {
    let mut breadcrumbs = baker_read_breadcrumbs(project_path.clone())
        .await?
        .ok_or("No breadcrumbs file found")?;

    let videos = breadcrumbs.video_links.as_mut().ok_or("No videos found")?;

    if from_index >= videos.len() || to_index >= videos.len() {
        return Err("Index out of bounds".to_string());
    }

    let video = videos.remove(from_index);
    videos.insert(to_index, video);
    breadcrumbs.last_modified = Some(chrono::Utc::now().to_rfc3339());
    write_breadcrumbs_file(&project_path, &breadcrumbs)?;

    Ok(breadcrumbs)
}

#[tauri::command]
pub async fn baker_get_trello_cards(project_path: String) -> Result<Vec<TrelloCard>, String> {
    let breadcrumbs = baker_read_breadcrumbs(project_path).await?;

    match breadcrumbs {
        Some(b) => Ok(migrate_trello_card_url(&b)),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn baker_associate_trello_card(
    project_path: String,
    trello_card: TrelloCard,
) -> Result<BreadcrumbsFile, String> {
    let mut breadcrumbs = baker_read_breadcrumbs(project_path.clone())
        .await?
        .ok_or("No breadcrumbs file found")?;

    if breadcrumbs.trello_cards.is_none() {
        breadcrumbs.trello_cards = Some(Vec::new());
    }

    let cards = breadcrumbs.trello_cards.as_mut().unwrap();

    if cards.len() >= 10 {
        return Err("Maximum of 10 Trello cards per project reached".to_string());
    }

    if cards.iter().any(|c| c.card_id == trello_card.card_id) {
        return Err("This Trello card is already associated with the project".to_string());
    }

    cards.push(trello_card);
    ensure_backward_compatible_write(&mut breadcrumbs);
    breadcrumbs.last_modified = Some(chrono::Utc::now().to_rfc3339());
    write_breadcrumbs_file(&project_path, &breadcrumbs)?;

    Ok(breadcrumbs)
}

#[tauri::command]
pub async fn baker_remove_trello_card(
    project_path: String,
    card_index: usize,
) -> Result<BreadcrumbsFile, String> {
    let mut breadcrumbs = baker_read_breadcrumbs(project_path.clone())
        .await?
        .ok_or("No breadcrumbs file found")?;

    let cards = breadcrumbs.trello_cards.as_mut().ok_or("No cards found")?;

    if card_index >= cards.len() {
        return Err("Card index out of bounds".to_string());
    }

    cards.remove(card_index);
    ensure_backward_compatible_write(&mut breadcrumbs);
    breadcrumbs.last_modified = Some(chrono::Utc::now().to_rfc3339());
    write_breadcrumbs_file(&project_path, &breadcrumbs)?;

    Ok(breadcrumbs)
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
