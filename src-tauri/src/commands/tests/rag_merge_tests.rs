/**
 * RAG Merge Tests
 * Issue: #234
 *
 * Invariants of `db_merge_bundled_examples`, which reconciles shipped bundled examples with the
 * user's active database on app startup. The critical invariant: user-uploaded examples are
 * never overwritten, even when their id collides with a bundled one.
 *
 * These exercise `db_merge_bundled_examples` through the same seam #221 established: the
 * function takes two `&Path` arguments (active db, bundled db) rather than an `AppHandle`, so
 * the tests need only `tempdir`s.
 */
use crate::commands::rag::db_merge_bundled_examples;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use tempfile::TempDir;

// ============================================================================
// Harness
// ============================================================================

/// The shipped database schema, written verbatim from `scripts/embed-examples-ollama.js`.
/// Both databases need the same schema.
const DB_SCHEMA: &str = "
    CREATE TABLE example_scripts (
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
    );
";

/// Create an empty database carrying the shipped schema, and return the `TempDir` guard with it.
///
/// The guard is returned rather than kept internally on purpose. A helper in the deleted
/// `rag_tests.rs` bound `tempdir()` to a local and returned only the path, so the directory was
/// removed while a connection to the database inside it was still open, and nine tests died with
/// `SqliteFailure(ReadOnly, 1032)` before reaching any assertion (issue #202). Callers must bind
/// the guard for as long as they hold a connection.
#[must_use]
fn test_db(name: &str) -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().expect("temp dir should be creatable");
    let db_path = temp_dir.path().join(format!("{name}.db"));

    let conn = Connection::open(&db_path).expect("database should be creatable");
    conn.execute_batch(DB_SCHEMA)
        .expect("schema should be creatable");
    drop(conn);

    (temp_dir, db_path)
}

fn seed_example(
    conn: &Connection,
    id: &str,
    title: &str,
    source: &str,
    before: &str,
    after: &str,
    tags: Option<&str>,
    quality_score: Option<i32>,
) {
    conn.execute(
        "INSERT INTO example_scripts
         (id, title, category, before_text, after_text, tags, word_count, quality_score, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            id,
            title,
            "educational",
            before,
            after,
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

fn seed_version(conn: &Connection, version: &str) {
    conn.execute(
        "INSERT INTO db_metadata (key, value) VALUES ('bundled_version', ?)",
        params![version],
    )
    .expect("seed version should insert");
}

fn encode_embedding(embedding: &[f32]) -> Vec<u8> {
    embedding.iter().flat_map(|f| f.to_le_bytes()).collect()
}

fn decode_embedding(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

/// Read an example row back from the database.
fn read_example(conn: &Connection, id: &str) -> Option<(String, String, String, String)> {
    conn.query_row(
        "SELECT title, before_text, after_text, source FROM example_scripts WHERE id = ?",
        params![id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        },
    )
    .ok()
}

/// Read an embedding back from the database.
fn read_embedding(conn: &Connection, script_id: &str) -> Option<(Vec<f32>, i32)> {
    conn.query_row(
        "SELECT embedding, dimension FROM embeddings WHERE script_id = ?",
        params![script_id],
        |row| Ok((row.get::<_, Vec<u8>>(0)?, row.get::<_, i32>(1)?)),
    )
    .ok()
    .map(|(blob, dimension)| (decode_embedding(&blob), dimension))
}

fn example_count(conn: &Connection) -> i64 {
    conn.query_row("SELECT COUNT(*) FROM example_scripts", [], |row| row.get(0))
        .expect("count should succeed")
}

// ============================================================================
// Spec 1: Bundled example present in both DBs is updated from bundled
// ============================================================================

/// Broken means a release ships improved examples but users keep the old versions forever,
/// silently receiving worse RAG results with no way to get the update short of deleting the
/// app data directory.
#[test]
fn merge_updates_bundled_example_from_shipped_copy() {
    let (_active_guard, active_path) = test_db("active");
    let (_bundled_guard, bundled_path) = test_db("bundled");

    // Seed the active DB with an older version of a bundled example
    {
        let conn = Connection::open(&active_path).unwrap();
        seed_example(
            &conn,
            "ex-1",
            "Old Title",
            "bundled",
            "old before",
            "old after",
            Some("old-tag"),
            Some(3),
        );
        seed_embedding(&conn, "ex-1", &[0.1, 0.2, 0.3]);
    }

    // Seed the bundled DB with a newer version
    {
        let conn = Connection::open(&bundled_path).unwrap();
        seed_example(
            &conn,
            "ex-1",
            "New Title",
            "bundled",
            "new before",
            "new after",
            Some("new-tag"),
            Some(5),
        );
        seed_embedding(&conn, "ex-1", &[0.9, 0.8, 0.7]);
        seed_version(&conn, "2.0");
    }

    db_merge_bundled_examples(&active_path, &bundled_path)
        .expect("merge should succeed");

    let conn = Connection::open(&active_path).unwrap();
    let (title, before, after, source) =
        read_example(&conn, "ex-1").expect("example should exist after merge");

    assert_eq!(title, "New Title", "title should be updated from bundled copy");
    assert_eq!(before, "new before", "before_text should be updated");
    assert_eq!(after, "new after", "after_text should be updated");
    assert_eq!(source, "bundled", "source should remain bundled");

    let (embedding, dim) =
        read_embedding(&conn, "ex-1").expect("embedding should exist after merge");
    assert_eq!(
        embedding,
        vec![0.9, 0.8, 0.7],
        "embedding should be updated from bundled copy"
    );
    assert_eq!(dim, 3, "dimension should match the new embedding");
}

// ============================================================================
// Spec 2: User-uploaded example is left alone when id collides
// ============================================================================

/// THE critical invariant. Broken means a release overwrites a user's own examples with shipped
/// content, destroying their work with no undo.
#[test]
fn merge_skips_user_uploaded_example_even_when_id_collides() {
    let (_active_guard, active_path) = test_db("active");
    let (_bundled_guard, bundled_path) = test_db("bundled");

    // Active DB has a user-uploaded example with an id that also appears in bundled
    {
        let conn = Connection::open(&active_path).unwrap();
        seed_example(
            &conn,
            "colliding-id",
            "User Title",
            "user-uploaded",
            "user before",
            "user after",
            Some("user-tag"),
            Some(4),
        );
        seed_embedding(&conn, "colliding-id", &[1.0, 2.0, 3.0]);
    }

    // Bundled DB has a different example with the same id
    {
        let conn = Connection::open(&bundled_path).unwrap();
        seed_example(
            &conn,
            "colliding-id",
            "Bundled Title",
            "bundled",
            "bundled before",
            "bundled after",
            Some("bundled-tag"),
            Some(5),
        );
        seed_embedding(&conn, "colliding-id", &[9.0, 8.0, 7.0]);
        seed_version(&conn, "2.0");
    }

    db_merge_bundled_examples(&active_path, &bundled_path)
        .expect("merge should succeed");

    let conn = Connection::open(&active_path).unwrap();
    let (title, before, after, source) =
        read_example(&conn, "colliding-id").expect("example should still exist");

    assert_eq!(
        title, "User Title",
        "user-uploaded title must be preserved, not overwritten by bundled"
    );
    assert_eq!(
        before, "user before",
        "user-uploaded before_text must be preserved"
    );
    assert_eq!(
        after, "user after",
        "user-uploaded after_text must be preserved"
    );
    assert_eq!(
        source, "user-uploaded",
        "source must remain user-uploaded, not changed to bundled"
    );

    let (embedding, _) =
        read_embedding(&conn, "colliding-id").expect("embedding should still exist");
    assert_eq!(
        embedding,
        vec![1.0, 2.0, 3.0],
        "user-uploaded embedding must be preserved"
    );
}

// ============================================================================
// Spec 3: Embeddings travel with their example
// ============================================================================

/// Broken means a newly inserted bundled example arrives without its embedding, so similarity
/// search can never retrieve it. The example lists in the management UI but RAG never finds it.
#[test]
fn merge_inserts_new_bundled_example_with_its_embedding() {
    let (_active_guard, active_path) = test_db("active");
    let (_bundled_guard, bundled_path) = test_db("bundled");

    // Active DB is empty (fresh install)
    // Bundled DB has an example with embedding
    {
        let conn = Connection::open(&bundled_path).unwrap();
        seed_example(
            &conn,
            "new-ex",
            "Brand New",
            "bundled",
            "new before",
            "new after",
            Some("intro"),
            Some(5),
        );
        seed_embedding(&conn, "new-ex", &[0.5, 0.5, 0.5, 0.5]);
        seed_version(&conn, "1.0");
    }

    db_merge_bundled_examples(&active_path, &bundled_path)
        .expect("merge should succeed");

    let conn = Connection::open(&active_path).unwrap();
    let (title, _, _, source) =
        read_example(&conn, "new-ex").expect("example should be inserted");
    assert_eq!(title, "Brand New");
    assert_eq!(source, "bundled");

    let (embedding, dim) =
        read_embedding(&conn, "new-ex").expect("embedding should be inserted with the example");
    assert_eq!(
        embedding,
        vec![0.5, 0.5, 0.5, 0.5],
        "the embedding should match what was in the bundled db"
    );
    assert_eq!(dim, 4, "dimension should match the embedding width");
}

// ============================================================================
// Spec 4: Bundled example removed from shipped DB is left in active
// ============================================================================

/// Design decision (issue #234): a bundled example that was shipped in a previous release but is
/// absent from the current bundled database is left in the active database. Removing it would
/// silently degrade RAG search quality for users who have been relying on it, and there is no UI
/// to undo the deletion or even notice it happened.
#[test]
fn merge_leaves_retired_bundled_example_in_active_db() {
    let (_active_guard, active_path) = test_db("active");
    let (_bundled_guard, bundled_path) = test_db("bundled");

    // Active DB has two bundled examples from an older release
    {
        let conn = Connection::open(&active_path).unwrap();
        seed_example(
            &conn,
            "kept",
            "Kept Example",
            "bundled",
            "kept before",
            "kept after",
            None,
            Some(4),
        );
        seed_embedding(&conn, "kept", &[0.1, 0.2]);
        seed_example(
            &conn,
            "retired",
            "Retired Example",
            "bundled",
            "retired before",
            "retired after",
            None,
            Some(3),
        );
        seed_embedding(&conn, "retired", &[0.3, 0.4]);
    }

    // New bundled DB only has one of the two
    {
        let conn = Connection::open(&bundled_path).unwrap();
        seed_example(
            &conn,
            "kept",
            "Kept Example v2",
            "bundled",
            "kept before v2",
            "kept after v2",
            None,
            Some(5),
        );
        seed_embedding(&conn, "kept", &[0.5, 0.6]);
        seed_version(&conn, "2.0");
    }

    db_merge_bundled_examples(&active_path, &bundled_path)
        .expect("merge should succeed");

    let conn = Connection::open(&active_path).unwrap();

    // The kept example should be updated
    let (title, _, _, _) =
        read_example(&conn, "kept").expect("kept example should still exist");
    assert_eq!(title, "Kept Example v2", "kept example should be updated");

    // The retired example should still be there, untouched
    let (title, before, after, source) =
        read_example(&conn, "retired").expect("retired example must not be deleted");
    assert_eq!(title, "Retired Example", "retired example title must be untouched");
    assert_eq!(before, "retired before", "retired example before_text must be untouched");
    assert_eq!(after, "retired after", "retired example after_text must be untouched");
    assert_eq!(source, "bundled", "retired example source must be untouched");

    let (embedding, _) =
        read_embedding(&conn, "retired").expect("retired example embedding must survive");
    assert_eq!(
        embedding,
        vec![0.3, 0.4],
        "retired example embedding must be untouched"
    );

    assert_eq!(example_count(&conn), 2, "both examples should remain");
}

// ============================================================================
// Spec 5: Version matching short-circuits the merge
// ============================================================================

/// Broken means the merge runs on every startup even when nothing has changed, doing redundant
/// writes. Not destructive, but measurably wasteful.
#[test]
fn merge_skips_when_versions_match() {
    let (_active_guard, active_path) = test_db("active");
    let (_bundled_guard, bundled_path) = test_db("bundled");

    // Both databases have the same version
    {
        let conn = Connection::open(&active_path).unwrap();
        seed_example(
            &conn,
            "ex-1",
            "Active Title",
            "bundled",
            "active before",
            "active after",
            None,
            Some(3),
        );
        seed_embedding(&conn, "ex-1", &[0.1, 0.2]);
        seed_version(&conn, "1.0");
    }
    {
        let conn = Connection::open(&bundled_path).unwrap();
        seed_example(
            &conn,
            "ex-1",
            "Bundled Title",
            "bundled",
            "bundled before",
            "bundled after",
            None,
            Some(5),
        );
        seed_embedding(&conn, "ex-1", &[0.9, 0.8]);
        seed_version(&conn, "1.0");
    }

    db_merge_bundled_examples(&active_path, &bundled_path)
        .expect("merge should succeed");

    // The active example should NOT have been updated because versions match
    let conn = Connection::open(&active_path).unwrap();
    let (title, _, _, _) =
        read_example(&conn, "ex-1").expect("example should exist");
    assert_eq!(
        title, "Active Title",
        "when versions match, examples should not be updated"
    );
}

// ============================================================================
// Spec 6: Mixed scenario - all three paths in one merge
// ============================================================================

/// Exercises the full merge with new, updated and skipped examples in a single call, verifying
/// the correct path is taken for each.
#[test]
fn merge_handles_mixed_new_updated_and_skipped_examples() {
    let (_active_guard, active_path) = test_db("active");
    let (_bundled_guard, bundled_path) = test_db("bundled");

    // Active DB: one bundled example to update, one user-uploaded to skip
    {
        let conn = Connection::open(&active_path).unwrap();
        seed_example(
            &conn,
            "to-update",
            "Old Bundled",
            "bundled",
            "old before",
            "old after",
            None,
            Some(3),
        );
        seed_embedding(&conn, "to-update", &[0.1, 0.2]);
        seed_example(
            &conn,
            "to-skip",
            "User Example",
            "user-uploaded",
            "user before",
            "user after",
            None,
            Some(4),
        );
        seed_embedding(&conn, "to-skip", &[1.0, 2.0]);
    }

    // Bundled DB: updated version of one, colliding id for user-uploaded, and a new one
    {
        let conn = Connection::open(&bundled_path).unwrap();
        seed_example(
            &conn,
            "to-update",
            "New Bundled",
            "bundled",
            "new before",
            "new after",
            None,
            Some(5),
        );
        seed_embedding(&conn, "to-update", &[0.9, 0.8]);
        seed_example(
            &conn,
            "to-skip",
            "Bundled Collision",
            "bundled",
            "bundled before",
            "bundled after",
            None,
            Some(5),
        );
        seed_embedding(&conn, "to-skip", &[9.0, 8.0]);
        seed_example(
            &conn,
            "brand-new",
            "Brand New",
            "bundled",
            "brand before",
            "brand after",
            None,
            Some(5),
        );
        seed_embedding(&conn, "brand-new", &[0.5, 0.5]);
        seed_version(&conn, "3.0");
    }

    db_merge_bundled_examples(&active_path, &bundled_path)
        .expect("merge should succeed");

    let conn = Connection::open(&active_path).unwrap();

    // Updated
    let (title, before, _, source) =
        read_example(&conn, "to-update").expect("updated example should exist");
    assert_eq!(title, "New Bundled", "bundled example should be updated");
    assert_eq!(before, "new before");
    assert_eq!(source, "bundled");
    let (emb, _) = read_embedding(&conn, "to-update").unwrap();
    assert_eq!(emb, vec![0.9, 0.8], "embedding should be updated");

    // Skipped (user-uploaded)
    let (title, before, _, source) =
        read_example(&conn, "to-skip").expect("skipped example should exist");
    assert_eq!(title, "User Example", "user example must not be overwritten");
    assert_eq!(before, "user before");
    assert_eq!(source, "user-uploaded");
    let (emb, _) = read_embedding(&conn, "to-skip").unwrap();
    assert_eq!(emb, vec![1.0, 2.0], "user embedding must not be overwritten");

    // New
    let (title, before, _, source) =
        read_example(&conn, "brand-new").expect("new example should be inserted");
    assert_eq!(title, "Brand New");
    assert_eq!(before, "brand before");
    assert_eq!(source, "bundled");
    let (emb, dim) = read_embedding(&conn, "brand-new").unwrap();
    assert_eq!(emb, vec![0.5, 0.5]);
    assert_eq!(dim, 2);

    assert_eq!(example_count(&conn), 3, "should have all three examples");
}
