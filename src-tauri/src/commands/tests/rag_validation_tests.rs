/**
 * RAG Validation Tests
 * Feature: 007-frontend-script-example
 *
 * Unit tests for the validation helpers in `commands::rag` that need no AppHandle.
 */
use crate::commands::rag::{
    calculate_word_count, validate_category, validate_embedding_dimensions, validate_text_content,
    validate_title,
};

// ============================================================================
// validate_title
// ============================================================================

#[test]
fn validate_title_rejects_titles_over_200_chars() {
    let error = validate_title(&"A".repeat(201)).expect_err("201 chars should be rejected");
    assert!(
        error.contains("Title too long"),
        "expected a length error, got: {error}"
    );
}

#[test]
fn validate_title_accepts_exactly_200_chars() {
    assert!(validate_title(&"A".repeat(200)).is_ok());
}

#[test]
fn validate_title_rejects_empty_and_whitespace_only() {
    for title in ["", "   ", "\t "] {
        let error = validate_title(title).expect_err("blank title should be rejected");
        assert!(
            error.contains("Title cannot be empty"),
            "expected an empty-title error for {title:?}, got: {error}"
        );
    }
}

#[test]
fn validate_title_rejects_newlines() {
    for title in ["Line one\nLine two", "Carriage\rreturn"] {
        let error = validate_title(title).expect_err("newline in title should be rejected");
        assert!(
            error.contains("Title cannot contain newlines"),
            "expected a newline error for {title:?}, got: {error}"
        );
    }
}

// ============================================================================
// validate_category
// ============================================================================

#[test]
fn validate_category_accepts_every_documented_category() {
    for category in [
        "educational",
        "business",
        "narrative",
        "interview",
        "documentary",
        "user-custom",
    ] {
        assert!(
            validate_category(category).is_ok(),
            "{category} should be a valid category"
        );
    }
}

#[test]
fn validate_category_rejects_unknown_category() {
    let error =
        validate_category("invalid-category").expect_err("unknown category should be rejected");
    assert!(
        error.contains("Invalid category"),
        "expected a category error, got: {error}"
    );
    assert!(
        error.contains("educational"),
        "error should list the valid options, got: {error}"
    );
}

// ============================================================================
// validate_text_content
// ============================================================================

#[test]
fn validate_text_content_rejects_content_under_50_chars() {
    let error = validate_text_content("Too short", "Before content")
        .expect_err("9 chars should be rejected");
    assert!(
        error.contains("too short"),
        "expected a length error, got: {error}"
    );
    assert!(
        error.contains("Before content"),
        "error should name the field it was given, got: {error}"
    );
}

#[test]
fn validate_text_content_accepts_exactly_50_chars() {
    assert!(validate_text_content(&"A".repeat(50), "Before content").is_ok());
}

#[test]
fn validate_text_content_measures_length_after_trimming() {
    // 40 characters padded to 60 with whitespace is still too short.
    let padded = format!("{}{}{}", " ".repeat(10), "A".repeat(40), " ".repeat(10));
    let error = validate_text_content(&padded, "After content")
        .expect_err("padding should not satisfy the minimum");
    assert!(
        error.contains("too short"),
        "expected a length error, got: {error}"
    );
}

#[test]
fn validate_text_content_rejects_content_over_100k_chars() {
    let error = validate_text_content(&"A".repeat(100_001), "Before content")
        .expect_err("100,001 chars should be rejected");
    assert!(
        error.contains("too long"),
        "expected a length error, got: {error}"
    );
}

// ============================================================================
// validate_embedding_dimensions
// ============================================================================

#[test]
fn validate_embedding_dimensions_accepts_both_supported_widths() {
    // 384 is all-MiniLM-L6-v2, 768 is nomic-embed-text. Both are in use, so both must pass.
    for dimensions in [384, 768] {
        let embedding: Vec<f32> = vec![0.1; dimensions];
        assert!(
            validate_embedding_dimensions(&embedding).is_ok(),
            "{dimensions} dimensions should be accepted"
        );
    }
}

#[test]
fn validate_embedding_dimensions_rejects_other_widths() {
    for dimensions in [0, 128, 385, 1536] {
        let embedding: Vec<f32> = vec![0.1; dimensions];
        let error = validate_embedding_dimensions(&embedding)
            .expect_err("unsupported width should be rejected");
        assert!(
            error.contains("Invalid embedding dimensions"),
            "expected a dimension error for {dimensions}, got: {error}"
        );
    }
}

// ============================================================================
// calculate_word_count
// ============================================================================

#[test]
fn calculate_word_count_counts_whitespace_separated_tokens() {
    assert_eq!(calculate_word_count("This is a test with seven words"), 7);
    assert_eq!(calculate_word_count("  padded \t tokens\nhere  "), 3);
    assert_eq!(calculate_word_count(""), 0);
}

// ============================================================================
// Storage-format contracts
// ============================================================================

#[test]
fn test_source_field_values() {
    // Contract: Source must be 'bundled' or 'user-uploaded'
    const BUNDLED: &str = "bundled";
    const USER_UPLOADED: &str = "user-uploaded";

    assert_eq!(BUNDLED, "bundled");
    assert_eq!(USER_UPLOADED, "user-uploaded");
}

#[test]
fn test_tags_format() {
    // Contract: Tags stored as comma-separated, returned as array
    let tags_string = "tag1,tag2,tag3";
    let tags_array: Vec<&str> = tags_string.split(',').collect();

    assert_eq!(tags_array.len(), 3);
    assert_eq!(tags_array[0], "tag1");
    assert_eq!(tags_array[2], "tag3");
}

#[test]
fn test_uuid_format() {
    // Contract: User-uploaded examples use UUID v4
    use uuid::Uuid;

    let new_id = Uuid::new_v4();
    let id_string = new_id.to_string();

    assert!(id_string.len() == 36); // UUID format: 8-4-4-4-12
    assert!(id_string.contains('-'));

    // Verify can parse it back
    let parsed = Uuid::parse_str(&id_string);
    assert!(parsed.is_ok());
}

#[test]
fn test_embedding_binary_conversion() {
    // Contract: Embeddings stored as little-endian f32 bytes
    let embedding: Vec<f32> = vec![1.0, 2.0, 3.0];

    // Convert to bytes (as done in upload_example)
    let bytes: Vec<u8> = embedding
        .iter()
        .flat_map(|f| f.to_le_bytes().to_vec())
        .collect();

    assert_eq!(bytes.len(), 12); // 3 floats × 4 bytes each

    // Verify can convert back
    let reconstructed: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();

    assert_eq!(reconstructed, embedding);
}

// ============================================================================
// The gap this file used to record
// ============================================================================
//
// This file previously ended with a "Known gap" listing the command-level contracts that had no
// test, because `get_all_examples`, `get_all_examples_with_metadata`, `upload_example`,
// `replace_example` and `delete_example` all resolved their database path through
// `app.path().app_data_dir()` and so needed a `tauri::AppHandle` that the crate had no harness
// for.
//
// That gap is closed in `rag_db_tests.rs` (issue #221). The SQL now lives in `db_*` functions
// taking a database path, each command being a wrapper that resolves the path and delegates, so
// the database invariants - the bundled-example protections, the embeddings cascade, transaction
// safety, ordering, tag conversion, the source field and the embedding encoding - are tested
// against a `tempdir` with no Tauri involved.
