/**
 * RAG Database Tests
 * Issue: #221
 *
 * Database-level invariants of the RAG example commands: the bundled-example protections, the
 * embeddings cascade, transaction safety, ordering, tag conversion and the source field.
 *
 * These exercise the `db_*` functions in `commands::rag`, which hold the SQL that each
 * `#[tauri::command]` wrapper delegates to once it has resolved the database path. That seam is
 * why these tests need no `tauri::AppHandle`, only a `tempdir`.
 */
use crate::commands::rag::{
    db_delete_example, db_get_all_examples, db_get_all_examples_with_metadata, db_replace_example,
    db_upload_example, ExampleMetadataInput, ReplaceExampleRequest, UploadExampleRequest,
};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use tempfile::TempDir;

// ============================================================================
// Harness
// ============================================================================

/// Create an empty database carrying the shipped schema, and return the `TempDir` guard with it.
///
/// The guard is returned rather than kept internally on purpose. A helper in the deleted
/// `rag_tests.rs` bound `tempdir()` to a local and returned only the path, so the directory was
/// removed while a connection to the database inside it was still open, and nine tests died with
/// `SqliteFailure(ReadOnly, 1032)` before reaching any assertion (issue #202). Callers must bind
/// the guard for as long as they hold a connection.
#[must_use]
fn test_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().expect("temp dir should be creatable");
    let db_path = temp_dir.path().join("examples.db");

    let conn = Connection::open(&db_path).expect("database should be creatable");
    // Schema as built by scripts/embed-examples-ollama.js, which produces the bundled database.
    conn.execute_batch(
        "CREATE TABLE example_scripts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            before_text TEXT NOT NULL,
            after_text TEXT NOT NULL,
            tags TEXT,
            word_count INTEGER,
            quality_score INTEGER,
            source TEXT DEFAULT 'bundled',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE embeddings (
            script_id TEXT PRIMARY KEY,
            embedding BLOB NOT NULL,
            dimension INTEGER NOT NULL,
            FOREIGN KEY(script_id) REFERENCES example_scripts(id)
        );

        CREATE TABLE db_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );",
    )
    .expect("schema should be creatable");
    drop(conn);

    (temp_dir, db_path)
}

/// A body of text long enough to be realistic; the `db_*` functions do not validate length.
fn long_text(marker: &str) -> String {
    format!(
        "{marker}: {}",
        "the quick brown fox jumps over the lazy dog. ".repeat(3)
    )
}

fn seed_example(
    conn: &Connection,
    id: &str,
    title: &str,
    source: &str,
    quality_score: Option<i32>,
    tags: Option<&str>,
) {
    conn.execute(
        "INSERT INTO example_scripts
         (id, title, category, before_text, after_text, tags, word_count, quality_score, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            id,
            title,
            "educational",
            long_text(&format!("{id} before")),
            long_text(&format!("{id} after")),
            tags,
            42,
            quality_score,
            source
        ],
    )
    .expect("seed example should insert");
}

fn seed_embedding(conn: &Connection, script_id: &str, embedding: &[f32]) {
    conn.execute(
        "INSERT INTO embeddings (script_id, embedding, dimension) VALUES (?, ?, ?)",
        params![
            script_id,
            encode_embedding(embedding),
            embedding.len() as i32
        ],
    )
    .expect("seed embedding should insert");
}

fn encode_embedding(embedding: &[f32]) -> Vec<u8> {
    embedding.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Decode the blob the way `blob_to_vec_f32` in `rag.rs` does: 4-byte little-endian chunks.
fn decode_embedding(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

fn stored_embedding(conn: &Connection, script_id: &str) -> Option<(Vec<f32>, i32)> {
    conn.query_row(
        "SELECT embedding, dimension FROM embeddings WHERE script_id = ?",
        params![script_id],
        |row| Ok((row.get::<_, Vec<u8>>(0)?, row.get::<_, i32>(1)?)),
    )
    .ok()
    .map(|(blob, dimension)| (decode_embedding(&blob), dimension))
}

fn count(conn: &Connection, sql: &str, id: &str) -> i64 {
    conn.query_row(sql, params![id], |row| row.get(0))
        .expect("count query should succeed")
}

fn upload_request(
    title: &str,
    tags: Option<Vec<String>>,
    embedding: Vec<f32>,
) -> UploadExampleRequest {
    UploadExampleRequest {
        before_content: long_text("uploaded before"),
        after_content: long_text("uploaded after"),
        metadata: ExampleMetadataInput {
            title: title.to_string(),
            category: "educational".to_string(),
            tags,
            quality_score: Some(4),
        },
        embedding,
    }
}

// ============================================================================
// Bundled-example protection
// ============================================================================

/// Spec 1. Broken means a user uploading over a bundled example destroys shipped content, with
/// no way back short of deleting the app data directory.
#[test]
fn db_replace_example_refuses_to_overwrite_bundled_content() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    seed_example(
        &conn,
        "bundled-1",
        "Bundled example",
        "bundled",
        Some(5),
        Some("a,b"),
    );
    seed_embedding(&conn, "bundled-1", &[0.25, 0.5, 0.75]);

    let error = db_replace_example(
        &db_path,
        "bundled-1",
        ReplaceExampleRequest {
            before_content: long_text("attacker before"),
            after_content: long_text("attacker after"),
            embedding: vec![9.0, 9.0, 9.0],
        },
    )
    .expect_err("replacing a bundled example should be rejected");

    assert!(
        error.contains("Cannot replace bundled example") && error.contains("bundled-1"),
        "error should refuse by name, got: {error}"
    );

    let (before, after): (String, String) = conn
        .query_row(
            "SELECT before_text, after_text FROM example_scripts WHERE id = 'bundled-1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("the bundled row should still be there");
    assert_eq!(
        before,
        long_text("bundled-1 before"),
        "before_text must be untouched"
    );
    assert_eq!(
        after,
        long_text("bundled-1 after"),
        "after_text must be untouched"
    );
    assert_eq!(
        stored_embedding(&conn, "bundled-1").map(|(vector, _)| vector),
        Some(vec![0.25, 0.5, 0.75]),
        "the bundled embedding must be untouched"
    );
}

/// Spec 2. Broken means shipped examples are permanently removable by a user, and RAG search
/// quietly degrades as they go.
#[test]
fn db_delete_example_refuses_to_delete_bundled_content() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    seed_example(
        &conn,
        "bundled-2",
        "Bundled example",
        "bundled",
        Some(5),
        None,
    );
    seed_embedding(&conn, "bundled-2", &[0.1, 0.2]);

    let error = db_delete_example(&db_path, "bundled-2")
        .expect_err("deleting a bundled example should be rejected");

    assert!(
        error.contains("Cannot delete bundled example") && error.contains("bundled-2"),
        "error should refuse by name, got: {error}"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM example_scripts WHERE id = ?",
            "bundled-2"
        ),
        1,
        "the bundled example row must survive"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM embeddings WHERE script_id = ?",
            "bundled-2"
        ),
        1,
        "the bundled embedding must survive"
    );
}

// ============================================================================
// Embeddings cascade
// ============================================================================

/// Spec 3. Broken means orphaned embedding rows accumulate: the schema's foreign key has no
/// `ON DELETE CASCADE` and `PRAGMA foreign_keys` is off by default, so this command's own
/// `DELETE` is the only thing enforcing it. An orphan is invisible in the UI and still holds the
/// `script_id` primary key, so a later insert reusing that id fails.
#[test]
fn db_delete_example_removes_the_embedding_with_the_example() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    seed_example(
        &conn,
        "user-1",
        "User example",
        "user-uploaded",
        Some(4),
        None,
    );
    seed_embedding(&conn, "user-1", &[0.3, 0.6, 0.9]);
    // A second example that must not be touched by the delete.
    seed_example(
        &conn,
        "user-2",
        "Other example",
        "user-uploaded",
        Some(4),
        None,
    );
    seed_embedding(&conn, "user-2", &[1.0, 1.0, 1.0]);

    db_delete_example(&db_path, "user-1").expect("deleting a user example should succeed");

    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM example_scripts WHERE id = ?",
            "user-1"
        ),
        0,
        "the example row should be gone"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM embeddings WHERE script_id = ?",
            "user-1"
        ),
        0,
        "the embedding row should be gone with it, not orphaned"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM embeddings WHERE script_id = ?",
            "user-2"
        ),
        1,
        "an unrelated embedding must be left alone"
    );
}

// ============================================================================
// Transaction safety
// ============================================================================

/// Spec 4. Broken means an example exists with no embedding: it lists in the management UI but
/// can never be retrieved by similarity search, and nothing tells the user.
#[test]
fn db_upload_example_writes_nothing_when_the_embedding_insert_fails() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    // Remove the second table of the pair so the example insert succeeds and the embedding
    // insert cannot.
    conn.execute("DROP TABLE embeddings", [])
        .expect("dropping embeddings should succeed");

    let error = db_upload_example(&db_path, upload_request("Half written", None, vec![0.5; 4]))
        .expect_err("an upload that cannot store its embedding should fail");
    assert!(
        error.contains("Failed to insert embedding"),
        "the embedding insert should be the reported failure, got: {error}"
    );

    let remaining: i64 = conn
        .query_row("SELECT COUNT(*) FROM example_scripts", [], |row| row.get(0))
        .expect("count should succeed");
    assert_eq!(
        remaining, 0,
        "a failed upload must leave no partial example row"
    );
}

// ============================================================================
// The source field
// ============================================================================

/// Spec 5. Broken means `source` is wrong, and `source` decides everything above: an upload
/// landing as 'bundled' is immediately un-editable and un-deletable by the user who created it,
/// and the reverse strips bundled content of the protection in the two tests above.
#[test]
fn db_upload_example_marks_the_new_row_user_uploaded() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");

    let new_id = db_upload_example(
        &db_path,
        upload_request(
            "Uploaded",
            Some(vec!["one".into(), "two".into()]),
            vec![0.5; 4],
        ),
    )
    .expect("a valid upload should succeed");

    assert!(
        uuid::Uuid::parse_str(&new_id).is_ok(),
        "the returned id should be a UUID, got: {new_id}"
    );

    let (source, title, word_count): (String, String, i32) = conn
        .query_row(
            "SELECT source, title, word_count FROM example_scripts WHERE id = ?",
            params![&new_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("the uploaded row should be findable by the returned id");

    assert_eq!(
        source, "user-uploaded",
        "an uploaded example must be marked user-uploaded"
    );
    assert_eq!(title, "Uploaded");
    assert_eq!(
        word_count,
        long_text("uploaded before").split_whitespace().count() as i32,
        "word_count should be derived from the before content"
    );
}

// ============================================================================
// Ordering
// ============================================================================

/// Spec 6. Broken means the example management list stops showing the best examples first, and
/// the tie-break stops being stable, so the list reorders between openings for no visible
/// reason.
#[test]
fn db_get_all_examples_with_metadata_orders_by_quality_then_title() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    // Inserted in an order that matches neither the expected output nor its reverse. The
    // lowest-quality example is also the alphabetically first, so ordering by title alone would
    // not produce the expected result either.
    seed_example(&conn, "b", "Beta", "bundled", Some(5), None);
    seed_example(&conn, "z", "Aardvark", "user-uploaded", Some(3), None);
    seed_example(&conn, "a", "Alpha", "bundled", Some(5), None);

    let examples = db_get_all_examples_with_metadata(&db_path).expect("query should succeed");

    let ordered: Vec<&str> = examples.iter().map(|e| e.title.as_str()).collect();
    assert_eq!(
        ordered,
        vec!["Alpha", "Beta", "Aardvark"],
        "highest quality first, ties broken by title ascending"
    );
    // Bundled and user-uploaded come back together, not filtered apart.
    let sources: Vec<&str> = examples.iter().map(|e| e.source.as_str()).collect();
    assert_eq!(sources, vec!["bundled", "bundled", "user-uploaded"]);
}

/// Spec 6, second statement. `get_all_examples` carries its own `ORDER BY`, so it can regress on
/// its own while the metadata query stays correct.
#[test]
fn db_get_all_examples_orders_by_quality_then_title() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    seed_example(&conn, "b", "Beta", "bundled", Some(5), None);
    seed_example(&conn, "z", "Aardvark", "user-uploaded", Some(3), None);
    seed_example(&conn, "a", "Alpha", "bundled", Some(5), None);

    let examples = db_get_all_examples(&db_path).expect("query should succeed");

    let ordered: Vec<&str> = examples.iter().map(|e| e.title.as_str()).collect();
    assert_eq!(ordered, vec!["Alpha", "Beta", "Aardvark"]);
}

// ============================================================================
// Tag conversion
// ============================================================================

/// Spec 7. Broken means the UI renders an empty tag chip, or tags with leading spaces that no
/// longer match the same tag typed without them.
#[test]
fn db_get_all_examples_with_metadata_converts_stored_tags_to_a_trimmed_array() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    seed_example(
        &conn,
        "plain",
        "Plain",
        "bundled",
        Some(4),
        Some("one,two,three"),
    );
    seed_example(
        &conn,
        "spaced",
        "Spaced",
        "bundled",
        Some(4),
        Some("  spaced , out  "),
    );
    seed_example(&conn, "empty", "Empty", "bundled", Some(4), Some(""));
    seed_example(&conn, "null", "Null", "bundled", Some(4), None);

    let examples = db_get_all_examples_with_metadata(&db_path).expect("query should succeed");
    let tags_for = |id: &str| -> Vec<String> {
        examples
            .iter()
            .find(|e| e.id == id)
            .unwrap_or_else(|| panic!("example {id} should be returned"))
            .tags
            .clone()
    };

    assert_eq!(tags_for("plain"), vec!["one", "two", "three"]);
    assert_eq!(
        tags_for("spaced"),
        vec!["spaced", "out"],
        "surrounding whitespace should be trimmed off each tag"
    );
    assert!(
        tags_for("empty").is_empty(),
        "an empty tags column must not become a one-element array holding an empty string"
    );
    assert!(
        tags_for("null").is_empty(),
        "a NULL tags column must become an empty array"
    );
}

// ============================================================================
// Embedding storage
// ============================================================================

/// Spec 8. Broken means every similarity score computed against that example is garbage, because
/// `blob_to_vec_f32` decodes little-endian unconditionally. Search results go silently wrong
/// rather than erroring.
#[test]
fn db_upload_example_stores_the_embedding_as_little_endian_f32_with_its_width() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");

    let mut embedding: Vec<f32> = vec![0.0; 768];
    embedding[0] = -1.5;
    embedding[1] = 0.125;
    embedding[767] = 42.25;

    let new_id = db_upload_example(&db_path, upload_request("Wide", None, embedding.clone()))
        .expect("a valid upload should succeed");

    let (decoded, dimension) =
        stored_embedding(&conn, &new_id).expect("the embedding row should exist");
    assert_eq!(
        dimension, 768,
        "the stored dimension should record the vector width"
    );
    assert_eq!(
        decoded, embedding,
        "the blob should decode back to the vector supplied"
    );
}

// ============================================================================
// Replace
// ============================================================================

/// Spec 9. Broken means a stale `word_count` or a stale embedding after a replace, so the
/// example is retrieved for the wrong queries - worse than not being retrieved at all.
#[test]
fn db_replace_example_updates_content_embedding_and_word_count_but_keeps_identity() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");
    seed_example(
        &conn,
        "user-3",
        "Original title",
        "user-uploaded",
        Some(4),
        Some("keep,me"),
    );
    seed_embedding(&conn, "user-3", &[0.1, 0.1, 0.1]);

    let new_before = long_text("replacement before with rather more words than the original had");
    db_replace_example(
        &db_path,
        "user-3",
        ReplaceExampleRequest {
            before_content: new_before.clone(),
            after_content: long_text("replacement after"),
            embedding: vec![0.4, 0.5, 0.6],
        },
    )
    .expect("replacing a user-uploaded example should succeed");

    let (before, after, word_count, title, category, source): (
        String,
        String,
        i32,
        String,
        String,
        String,
    ) = conn
        .query_row(
            "SELECT before_text, after_text, word_count, title, category, source
             FROM example_scripts WHERE id = 'user-3'",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            },
        )
        .expect("the row should still exist under the same id");

    assert_eq!(before, new_before);
    assert_eq!(after, long_text("replacement after"));
    assert_eq!(
        word_count,
        new_before.split_whitespace().count() as i32,
        "word_count should be recalculated from the new before content"
    );
    assert_eq!(title, "Original title", "replace must not change the title");
    assert_eq!(
        category, "educational",
        "replace must not change the category"
    );
    assert_eq!(
        source, "user-uploaded",
        "replace must not change the source"
    );
    assert_eq!(
        stored_embedding(&conn, "user-3").map(|(vector, _)| vector),
        Some(vec![0.4, 0.5, 0.6]),
        "the embedding should be replaced alongside the content"
    );
}

/// Spec 9, second half. Broken means a replace against an unknown id inserts a row, creating an
/// example the user never uploaded.
#[test]
fn db_replace_example_reports_a_missing_example_and_writes_nothing() {
    let (_guard, db_path) = test_db();
    let conn = Connection::open(&db_path).expect("connection should open");

    let error = db_replace_example(
        &db_path,
        "does-not-exist",
        ReplaceExampleRequest {
            before_content: long_text("before"),
            after_content: long_text("after"),
            embedding: vec![0.1, 0.2],
        },
    )
    .expect_err("replacing an unknown id should fail");

    assert!(
        error.contains("Example not found") && error.contains("does-not-exist"),
        "error should name the missing id, got: {error}"
    );
    let rows: i64 = conn
        .query_row("SELECT COUNT(*) FROM example_scripts", [], |row| row.get(0))
        .expect("count should succeed");
    assert_eq!(rows, 0, "a failed replace must not insert anything");
}
