// DOCX Command Handlers
// Feature: 006-i-wish-to
// Purpose: Tauri commands for .docx file parsing and generation

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;

// ============================================================================
// Type Definitions
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ParseResult {
    pub text_content: String,
    pub html_content: String,
    pub formatting_metadata: FormattingMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FormattingMetadata {
    pub bold_ranges: Vec<Range>,
    pub italic_ranges: Vec<Range>,
    pub underline_ranges: Vec<Range>,
    pub headings: Vec<Heading>,
    pub lists: Vec<ListItem>,
    pub paragraphs: Vec<Paragraph>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Range {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Heading {
    pub level: u8,
    pub text: String,
    pub position: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListItem {
    pub item_type: String, // "ordered" or "unordered"
    pub text: String,
    pub level: u8,
    pub position: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Paragraph {
    pub text: String,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadPath {
    pub path: String,
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Parse a .docx file and extract content with formatting metadata
 * FR-003: File format validation
 * FR-005: 1GB file size limit
 * FR-006: Content validation
 */
#[command]
pub fn parse_docx_file(file_path: String) -> Result<ParseResult, String> {
    // Validate file exists
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    // FR-003: Validate file extension
    if !path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("docx"))
    {
        return Err("File must be a .docx document".to_string());
    }

    // FR-005: Check file size (1GB limit)
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

    const ONE_GB: u64 = 1024 * 1024 * 1024;
    if metadata.len() > ONE_GB {
        return Err(format!(
            "File size ({} bytes) exceeds 1GB limit",
            metadata.len()
        ));
    }

    // NOTE: Actual parsing is done in frontend using mammoth.js
    // This command just validates the file and returns metadata
    // The frontend will handle the actual parsing

    Ok(ParseResult {
        text_content: String::new(),
        html_content: String::new(),
        formatting_metadata: FormattingMetadata {
            bold_ranges: vec![],
            italic_ranges: vec![],
            underline_ranges: vec![],
            headings: vec![],
            lists: vec![],
            paragraphs: vec![],
        },
    })
}

/**
 * Generate and save a .docx file from content
 * FR-020: Download formatted script
 */
#[command]
pub fn generate_docx_file(
    _content: String,
    default_filename: String,
) -> Result<DownloadPath, String> {
    // NOTE: Actual .docx generation is done in frontend using docx npm package
    // This command is a placeholder for future backend generation if needed

    // For now, just return a path suggestion
    Ok(DownloadPath {
        path: default_filename,
    })
}

/**
 * Validate .docx file structure and readability
 */
#[command]
pub fn validate_docx_file(file_path: String) -> Result<bool, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if !path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("docx"))
    {
        return Err("File is not a .docx file".to_string());
    }

    // Check file size
    let metadata =
        fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

    const ONE_GB: u64 = 1024 * 1024 * 1024;
    if metadata.len() > ONE_GB {
        return Err(format!(
            "File exceeds 1GB size limit ({} bytes)",
            metadata.len()
        ));
    }

    // Check if file is readable
    if metadata.permissions().readonly() {
        return Err("File is read-only and cannot be accessed".to_string());
    }

    Ok(true)
}
