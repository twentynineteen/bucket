//! Locking and writing the file. Nothing here knows what the file means.

use std::collections::HashMap;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use super::TEMP_PREFIX;

/// One lock per project folder, held for a whole read-change-write so two
/// changes to the same file cannot lose each other's edits.
pub fn lock_for(project: &Path) -> Arc<Mutex<()>> {
    static LOCKS: OnceLock<Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>> = OnceLock::new();
    let key = lock_key(project);
    let mut locks = LOCKS
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    Arc::clone(locks.entry(key).or_default())
}

/// The same folder reached by different spellings must share a lock. APFS and
/// SMB volumes are case-insensitive by default, so the key is canonical and
/// lower-cased. A folder that does not exist cannot be canonicalised; it can
/// also not be written, so its plain spelling is a good enough key.
fn lock_key(project: &Path) -> PathBuf {
    let path = fs::canonicalize(project).unwrap_or_else(|_| project.to_path_buf());
    PathBuf::from(path.to_string_lossy().to_lowercase())
}

/// Replaces `target` with `contents` so a reader sees either the old file or
/// the new one, never half of each: write a sibling temp file, flush it, then
/// rename it over the target.
pub fn write_atomically(target: &Path, contents: &[u8]) -> io::Result<()> {
    let dir = target.parent().unwrap_or(Path::new("."));
    let temp = dir.join(format!("{TEMP_PREFIX}{}", uuid::Uuid::new_v4()));

    let result = (|| {
        let mut file = fs::File::create(&temp)?;
        file.write_all(contents)?;
        file.sync_all()?;
        fs::rename(&temp, target)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}
