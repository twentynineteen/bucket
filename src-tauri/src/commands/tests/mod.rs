mod premiere_test;
mod rag_validation_tests;
mod sprout_upload_tests;

/// Guard: every `.rs` file in this directory other than `mod.rs` must be declared above.
///
/// Rust only compiles what a `mod` declaration reaches, so an undeclared `.rs` file here is
/// inert: never built, never run, unable even to fail, while still reading as coverage to
/// anyone who opens it. That is how `premiere_test.rs` and `rag_tests.rs` sat unreferenced
/// for months (issue #202).
///
/// This reads the directory at runtime rather than comparing against a second
/// hand-maintained list, so the guard cannot drift out of date the way the registry it
/// guards did.
#[test]
fn every_test_file_is_declared_in_mod_rs() {
    use std::path::Path;

    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/commands/tests");

    let mod_rs = std::fs::read_to_string(dir.join("mod.rs"))
        .unwrap_or_else(|e| panic!("mod.rs should be readable at {}: {e}", dir.display()));

    let declared: Vec<&str> = mod_rs
        .lines()
        .map(str::trim)
        .filter(|line| !line.starts_with("//"))
        .filter_map(|line| {
            line.strip_prefix("pub ")
                .unwrap_or(line)
                .strip_prefix("mod ")?
                .strip_suffix(';')
        })
        .map(str::trim)
        .collect();

    let mut undeclared: Vec<String> = std::fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("tests directory should be readable: {e}"))
        .map(|entry| entry.expect("directory entry should be readable").path())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("rs"))
        .filter_map(|path| {
            path.file_stem()
                .and_then(|stem| stem.to_str())
                .map(str::to_owned)
        })
        .filter(|stem| stem != "mod")
        .filter(|stem| !declared.contains(&stem.as_str()))
        .collect();
    undeclared.sort();

    assert!(
        undeclared.is_empty(),
        "test file(s) in src-tauri/src/commands/tests/ are not declared in mod.rs, so they are \
         never compiled and never run: {}. Add `mod <name>;` to mod.rs, or delete the file.",
        undeclared.join(", ")
    );
}
