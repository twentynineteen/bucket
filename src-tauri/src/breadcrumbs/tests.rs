//! Behaviour tests for #303, named after the issue's behaviour IDs.
//!
//! Every test goes through the module's interface (`read`, `apply`,
//! `preview`) against a real project folder in a temp directory.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Barrier};
use std::thread;

use serde_json::{json, Value};
use tempfile::TempDir;

use super::*;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/// A temp parent folder holding one project folder named `Proj`.
struct Fixture {
    _root: TempDir,
    project: PathBuf,
}

impl Fixture {
    /// A project folder with no `Footage/` and no breadcrumbs file.
    fn bare() -> Self {
        let root = TempDir::new().unwrap();
        let project = root.path().join("Proj");
        fs::create_dir_all(&project).unwrap();
        Fixture {
            _root: root,
            project,
        }
    }

    /// A project with `Footage/Camera N` folders holding the given files,
    /// each `size` bytes long.
    fn with_footage(cameras: &[(i32, &[&str])], size: usize) -> Self {
        let fx = Self::bare();
        for (camera, files) in cameras {
            let dir = fx.project.join("Footage").join(format!("Camera {camera}"));
            fs::create_dir_all(&dir).unwrap();
            for name in *files {
                fs::write(dir.join(name), vec![b'x'; size]).unwrap();
            }
        }
        fx
    }

    fn file(&self) -> PathBuf {
        self.project.join("breadcrumbs.json")
    }

    fn backup(&self) -> PathBuf {
        self.project.join("breadcrumbs.json.bak")
    }

    fn write_json(&self, value: &Value) {
        fs::write(self.file(), serde_json::to_string_pretty(value).unwrap()).unwrap();
    }

    fn write_raw(&self, content: &str) {
        fs::write(self.file(), content).unwrap();
    }

    fn bytes(&self) -> Vec<u8> {
        fs::read(self.file()).unwrap()
    }

    fn on_disk(&self) -> Value {
        serde_json::from_slice(&self.bytes()).unwrap()
    }

    fn parent(&self) -> String {
        self.project.parent().unwrap().to_string_lossy().to_string()
    }

    fn apply_one(&self, change: &Change) -> Result<Breadcrumbs, ChangeError> {
        apply(&[&self.project], change).pop().unwrap()
    }
}

/// A well-formed file for `fx` with the given extra top-level fields merged in.
fn well_formed(fx: &Fixture, extra: Value) -> Value {
    let mut base = json!({
        "projectTitle": "Proj",
        "numberOfCameras": 1,
        "files": [],
        "parentFolder": fx.parent(),
        "createdBy": "Alice",
        "creationDateTime": "2026-01-01T00:00:00+00:00"
    });
    if let (Value::Object(base_map), Value::Object(extra_map)) = (&mut base, extra) {
        base_map.extend(extra_map);
    }
    base
}

fn link(url: &str) -> VideoLink {
    VideoLink {
        url: url.to_string(),
        sprout_video_id: None,
        title: format!("Video {url}"),
        thumbnail_url: None,
        upload_date: None,
        source_render_file: None,
    }
}

fn card(id: &str) -> TrelloCard {
    TrelloCard {
        url: format!("https://trello.com/c/{id}/project"),
        card_id: id.to_string(),
        title: format!("Card {id}"),
        board_name: None,
        last_fetched: None,
    }
}

fn links_json(urls: &[&str]) -> Value {
    serde_json::to_value(urls.iter().map(|u| link(u)).collect::<Vec<_>>()).unwrap()
}

fn cards_json(ids: &[&str]) -> Value {
    serde_json::to_value(ids.iter().map(|id| card(id)).collect::<Vec<_>>()).unwrap()
}

fn found(fx: &Fixture) -> (Breadcrumbs, Vec<Fix>) {
    match read(&fx.project) {
        Read::Found { file, fixes } => (file, fixes),
        other => panic!("expected Found, got {other:?}"),
    }
}

fn urls(file: &Breadcrumbs) -> Vec<&str> {
    file.video_links.iter().map(|l| l.url.as_str()).collect()
}

/// Every named change, for the preview-equals-apply property.
fn all_changes() -> Vec<(&'static str, Change)> {
    vec![
        ("rescan", Change::Rescan),
        ("refreshSizes", Change::RefreshSizes),
        (
            "addVideoLink",
            Change::AddVideoLink {
                link: link("https://v/new"),
            },
        ),
        (
            "updateVideoLink",
            Change::UpdateVideoLink {
                index: 0,
                expected_url: "https://v/a".to_string(),
                link: link("https://v/a2"),
            },
        ),
        ("removeVideoLink", Change::RemoveVideoLink { index: 1 }),
        (
            "reorderVideoLinks",
            Change::ReorderVideoLinks { from: 0, to: 1 },
        ),
        (
            "addTrelloCard",
            Change::AddTrelloCard {
                card: card("cardnew1"),
            },
        ),
        (
            "removeTrelloCard",
            Change::RemoveTrelloCard {
                card_id: "carda001".to_string(),
            },
        ),
    ]
}

/// A project with footage, two video links and one card, for change tests.
fn linked_project() -> Fixture {
    let fx = Fixture::with_footage(&[(1, &["a.mp4", "b.mp4"])], 10);
    fx.write_json(&well_formed(
        &fx,
        json!({
            "videoLinks": links_json(&["https://v/a", "https://v/b"]),
            "trelloCards": cards_json(&["carda001"])
        }),
    ));
    fx
}

// ---------------------------------------------------------------------------
// B1 - Read
// ---------------------------------------------------------------------------

#[test]
fn b1_1_missing_file_reads_as_missing_and_creates_nothing() {
    let fx = Fixture::bare();
    assert_eq!(read(&fx.project), Read::Missing);
    assert!(!fx.file().exists());
}

#[test]
fn b1_2_well_formed_file_reads_without_fixes_and_is_untouched() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(&fx, json!({})));
    let before = fx.bytes();

    let (file, fixes) = found(&fx);

    assert_eq!(file.project_title, "Proj");
    assert!(fixes.is_empty());
    assert_eq!(fx.bytes(), before);
}

#[test]
fn b1_3_object_created_by_takes_its_data_string() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({ "createdBy": { "data": "Alice" } }),
    ));
    let before = fx.bytes();

    let (file, fixes) = found(&fx);

    assert_eq!(file.created_by, "Alice");
    assert!(fixes.contains(&Fix::CreatedByNotAString));
    assert_eq!(fx.bytes(), before);
}

#[test]
fn b1_3_object_created_by_without_data_becomes_unknown() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(&fx, json!({ "createdBy": { "name": 7 } })));

    let (file, fixes) = found(&fx);

    assert_eq!(file.created_by, "Unknown");
    assert!(fixes.contains(&Fix::CreatedByNotAString));
}

#[test]
fn b1_4_legacy_trello_card_url_migrates_into_trello_cards() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({ "trelloCardUrl": "https://trello.com/c/abcd1234/some-project" }),
    ));

    let (file, fixes) = found(&fx);

    assert_eq!(file.trello_cards.len(), 1);
    assert_eq!(file.trello_cards[0].card_id, "abcd1234");
    assert!(!file.extra.contains_key("trelloCardUrl"));
    assert!(fixes.contains(&Fix::MigratedTrelloCardUrl));
}

#[test]
fn b1_5_legacy_url_for_an_already_linked_card_adds_no_duplicate() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({
            "trelloCardUrl": "https://trello.com/c/carda001/project",
            "trelloCards": cards_json(&["carda001"])
        }),
    ));

    let (file, fixes) = found(&fx);

    assert_eq!(file.trello_cards.len(), 1);
    assert!(!file.extra.contains_key("trelloCardUrl"));
    // Old card commands mirrored the first card here on every write; nothing
    // is lost by dropping it, so it is not a repair worth a backup.
    assert!(fixes.is_empty(), "{fixes:?}");
}

#[test]
fn b1_6_invalid_json_reads_as_unreadable() {
    let fx = Fixture::bare();
    fx.write_raw("{ this is not json");

    assert!(matches!(read(&fx.project), Read::Unreadable { .. }));
}

#[test]
fn b1_6_missing_required_field_reads_as_unreadable() {
    let fx = Fixture::bare();
    let mut value = well_formed(&fx, json!({}));
    value.as_object_mut().unwrap().remove("projectTitle");
    fx.write_json(&value);

    assert!(matches!(read(&fx.project), Read::Unreadable { .. }));
}

#[test]
fn b1_7_parent_folder_naming_the_project_itself_is_fixed() {
    let fx = Fixture::bare();
    // Authored on another machine: the stored path is not this machine's.
    fx.write_json(&well_formed(
        &fx,
        json!({ "parentFolder": "/Volumes/Other/Clients/Proj" }),
    ));

    let (file, fixes) = found(&fx);

    assert_eq!(file.parent_folder, "/Volumes/Other/Clients");
    assert!(fixes.contains(&Fix::ParentFolderWasProjectFolder));
}

#[test]
fn b1_7_a_correct_parent_folder_sharing_the_project_name_is_left_alone() {
    // A project at .../Proj/Proj: its correct parentFolder ends in "Proj" too.
    let root = TempDir::new().unwrap();
    let project = root.path().join("Proj").join("Proj");
    fs::create_dir_all(&project).unwrap();
    let fx = Fixture {
        _root: root,
        project,
    };
    fx.write_json(&well_formed(&fx, json!({})));

    let (file, fixes) = found(&fx);

    assert_eq!(file.parent_folder, fx.parent());
    assert!(fixes.is_empty(), "{fixes:?}");
}

#[test]
fn b1_4_card_ids_follow_the_old_rule_for_long_runs() {
    let fx = Fixture::bare();
    let long_id = "a".repeat(30);
    fx.write_json(&well_formed(
        &fx,
        json!({ "trelloCardUrl": format!("https://trello.com/c/{long_id}/p") }),
    ));

    let (file, _) = found(&fx);

    assert_eq!(file.trello_cards[0].card_id, "a".repeat(24));
}

#[test]
fn b1_8_a_missing_project_folder_is_not_a_missing_file() {
    let fx = Fixture::bare();
    let gone = fx.project.join("unmounted");

    assert_eq!(read(&gone), Read::ProjectNotFound);
}

#[cfg(unix)]
#[test]
fn b1_9_a_file_the_os_will_not_read_is_never_replaced() {
    use std::os::unix::fs::PermissionsExt;

    let fx = linked_project();
    let original = fx.bytes();
    fs::set_permissions(fx.file(), fs::Permissions::from_mode(0o000)).unwrap();
    if fs::read(fx.file()).is_ok() {
        // Running as root: permissions cannot make the file unreadable.
        fs::set_permissions(fx.file(), fs::Permissions::from_mode(0o644)).unwrap();
        return;
    }

    let read_result = read(&fx.project);
    let rescan = fx.apply_one(&Change::Rescan);
    let add = fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/new"),
    });

    fs::set_permissions(fx.file(), fs::Permissions::from_mode(0o644)).unwrap();
    assert!(
        matches!(read_result, Read::Inaccessible { .. }),
        "{read_result:?}"
    );
    assert!(matches!(rescan, Err(ChangeError::Io { .. })), "{rescan:?}");
    assert!(matches!(add, Err(ChangeError::Io { .. })), "{add:?}");
    assert_eq!(fx.bytes(), original);
    assert!(!fx.backup().exists());
}

// ---------------------------------------------------------------------------
// B2 - Apply (common)
// ---------------------------------------------------------------------------

#[test]
fn b2_1_unknown_fields_survive_a_write() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({ "futureField": { "nested": [1, 2, 3] }, "anotherOne": "kept" }),
    ));

    fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/1"),
    })
    .unwrap();

    let disk = fx.on_disk();
    assert_eq!(disk["futureField"], json!({ "nested": [1, 2, 3] }));
    assert_eq!(disk["anotherOne"], "kept");
}

#[test]
fn b2_2_a_file_that_needed_fixes_is_backed_up_before_the_write() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({ "createdBy": { "data": "Alice" } }),
    ));
    let original = fx.bytes();

    fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/1"),
    })
    .unwrap();

    assert_eq!(fs::read(fx.backup()).unwrap(), original);
    assert_eq!(fx.on_disk()["createdBy"], "Alice");
}

#[test]
fn b2_3_a_well_formed_file_gets_no_backup() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(&fx, json!({})));

    fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/1"),
    })
    .unwrap();

    assert!(!fx.backup().exists());
}

#[test]
fn b2_4_last_modified_is_stamped_at_write_time() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(&fx, json!({})));

    let before = chrono::Utc::now();
    let file = fx
        .apply_one(&Change::AddVideoLink {
            link: link("https://v/1"),
        })
        .unwrap();
    let after = chrono::Utc::now();

    let stamped = chrono::DateTime::parse_from_rfc3339(file.last_modified.as_deref().unwrap())
        .expect("lastModified is RFC 3339");
    assert!(
        stamped >= before && stamped <= after,
        "{stamped} not in [{before}, {after}]"
    );
    assert_eq!(fx.on_disk()["lastModified"], json!(file.last_modified));
}

#[test]
fn b2_5_written_files_never_hold_trello_card_url() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({ "trelloCardUrl": "https://trello.com/c/abcd1234/p" }),
    ));

    fx.apply_one(&Change::AddTrelloCard {
        card: card("cardb002"),
    })
    .unwrap();

    let disk = fx.on_disk();
    assert!(disk.get("trelloCardUrl").is_none());
    assert_eq!(disk["trelloCards"].as_array().unwrap().len(), 2);
}

#[test]
fn b2_6_one_failing_project_does_not_stop_the_others() {
    let a = Fixture::bare();
    a.write_json(&well_formed(&a, json!({})));
    let c = Fixture::bare();
    c.write_json(&well_formed(&c, json!({})));
    let missing = a.project.parent().unwrap().join("does-not-exist");

    let results = apply(
        &[a.project.clone(), missing, c.project.clone()],
        &Change::AddVideoLink {
            link: link("https://v/1"),
        },
    );

    assert_eq!(results.len(), 3);
    assert_eq!(urls(results[0].as_ref().unwrap()), vec!["https://v/1"]);
    assert_eq!(results[1], Err(ChangeError::ProjectNotFound));
    assert_eq!(urls(results[2].as_ref().unwrap()), vec!["https://v/1"]);
}

#[test]
fn b2_7_concurrent_applies_to_one_project_all_land() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(&fx, json!({})));
    let project = Arc::new(fx.project.clone());
    let barrier = Arc::new(Barrier::new(40));

    let handles: Vec<_> = (0..40)
        .map(|i| {
            let project = Arc::clone(&project);
            let barrier = Arc::clone(&barrier);
            thread::spawn(move || {
                let change = if i % 2 == 0 {
                    Change::AddVideoLink {
                        link: link(&format!("https://v/{i}")),
                    }
                } else {
                    Change::AddTrelloCard {
                        card: card(&format!("card{i:04}")),
                    }
                };
                barrier.wait();
                apply(&[project.as_path()], &change).pop().unwrap()
            })
        })
        .collect();
    for handle in handles {
        handle.join().unwrap().unwrap();
    }

    let disk = fx.on_disk();
    assert_eq!(disk["videoLinks"].as_array().unwrap().len(), 20);
    assert_eq!(disk["trelloCards"].as_array().unwrap().len(), 20);
}

#[cfg(unix)]
#[test]
fn b2_7_two_spellings_of_one_folder_share_the_lock() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(&fx, json!({})));
    let alias = fx.project.parent().unwrap().join("Alias");
    std::os::unix::fs::symlink(&fx.project, &alias).unwrap();
    let barrier = Arc::new(Barrier::new(20));

    let handles: Vec<_> = (0..20)
        .map(|i| {
            let spelling = if i % 2 == 0 {
                fx.project.clone()
            } else {
                alias.clone()
            };
            let barrier = Arc::clone(&barrier);
            thread::spawn(move || {
                barrier.wait();
                let change = Change::AddVideoLink {
                    link: link(&format!("https://v/{i}")),
                };
                apply(&[spelling], &change).pop().unwrap()
            })
        })
        .collect();
    for handle in handles {
        handle.join().unwrap().unwrap();
    }

    assert_eq!(fx.on_disk()["videoLinks"].as_array().unwrap().len(), 20);
}

#[cfg(unix)]
#[test]
fn b2_8_a_failed_write_leaves_the_original_untouched() {
    use std::os::unix::fs::PermissionsExt;

    let fx = Fixture::bare();
    fx.write_json(&well_formed(&fx, json!({})));
    let original = fx.bytes();
    fs::set_permissions(&fx.project, fs::Permissions::from_mode(0o555)).unwrap();

    let result = fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/1"),
    });

    fs::set_permissions(&fx.project, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(
        matches!(result, Err(ChangeError::Io { .. })),
        "got {result:?}"
    );
    assert_eq!(fx.bytes(), original);
}

#[test]
fn b2_9_only_rescan_touches_an_unreadable_file() {
    let fx = Fixture::bare();
    fx.write_raw("{ broken");

    let result = fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/1"),
    });

    assert!(
        matches!(result, Err(ChangeError::Unreadable { .. })),
        "got {result:?}"
    );
    assert_eq!(fx.bytes(), b"{ broken");
}

// ---------------------------------------------------------------------------
// B3 - Create
// ---------------------------------------------------------------------------

#[test]
fn b3_1_create_records_project_relative_footage() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4", "b.mp4"]), (2, &["c.mov"])], 10);
    fs::write(fx.project.join("Footage/Camera 1/.DS_Store"), b"x").unwrap();

    let file = fx
        .apply_one(&Change::Create {
            title: "My Shoot".into(),
            created_by: "Alice".into(),
        })
        .unwrap();

    let mut paths: Vec<_> = file
        .files
        .iter()
        .map(|f| (f.camera, f.path.as_str()))
        .collect();
    paths.sort();
    assert_eq!(
        paths,
        vec![
            (1, "Footage/Camera 1/a.mp4"),
            (1, "Footage/Camera 1/b.mp4"),
            (2, "Footage/Camera 2/c.mov"),
        ]
    );
    assert_eq!(file.number_of_cameras, 2);
    assert_eq!(file.project_title, "My Shoot");
    assert_eq!(file.created_by, "Alice");
    assert_eq!(file.parent_folder, fx.parent());
    assert!(chrono::DateTime::parse_from_rfc3339(&file.creation_date_time).is_ok());
    assert_eq!(fx.on_disk()["projectTitle"], "My Shoot");
}

#[test]
fn b3_2_create_refuses_an_existing_file() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"])], 10);
    fx.write_json(&well_formed(&fx, json!({})));
    let before = fx.bytes();

    let result = fx.apply_one(&Change::Create {
        title: "X".into(),
        created_by: "Bob".into(),
    });

    assert_eq!(result, Err(ChangeError::AlreadyExists));
    assert_eq!(fx.bytes(), before);
}

// ---------------------------------------------------------------------------
// B4 - Rescan
// ---------------------------------------------------------------------------

#[test]
fn b4_1_rescan_matches_files_and_size_to_the_folder() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4", "b.mp4"])], 100);
    fx.write_json(&well_formed(
        &fx,
        json!({
            "files": [{ "camera": 1, "name": "gone.mp4", "path": "Footage/Camera 1/gone.mp4" }],
            "folderSizeBytes": 5
        }),
    ));

    let file = fx.apply_one(&Change::Rescan).unwrap();

    let mut names: Vec<_> = file.files.iter().map(|f| f.name.as_str()).collect();
    names.sort();
    assert_eq!(names, vec!["a.mp4", "b.mp4"]);
    // The footage, not the metadata file the write itself changes.
    assert_eq!(file.folder_size_bytes, Some(200));
}

#[test]
fn b4_2_rescan_counts_camera_folders_including_empty_ones() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"]), (2, &["b.mp4"]), (3, &[])], 10);
    fx.write_json(&well_formed(&fx, json!({ "numberOfCameras": 1 })));

    let file = fx.apply_one(&Change::Rescan).unwrap();

    assert_eq!(file.number_of_cameras, 3);
}

#[test]
fn b4_3_rescan_keeps_links_and_cards() {
    let fx = linked_project();

    let file = fx.apply_one(&Change::Rescan).unwrap();

    assert_eq!(urls(&file), vec!["https://v/a", "https://v/b"]);
    assert_eq!(file.trello_cards, vec![card("carda001")]);
}

#[test]
fn b4_4_rescan_never_changes_created_by_and_sets_scanned_by() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"])], 10);
    fx.write_json(&well_formed(&fx, json!({})));

    let file = fx.apply_one(&Change::Rescan).unwrap();

    assert_eq!(file.created_by, "Alice");
    assert_eq!(file.scanned_by.as_deref(), Some("Baker"));
}

#[test]
fn b4_5_rescan_regenerates_an_unreadable_file_and_keeps_links() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"])], 10);
    // Valid JSON, but the wrong shape: files is a string.
    let mut value = well_formed(
        &fx,
        json!({
            "videoLinks": links_json(&["https://v/a"]),
            "trelloCards": cards_json(&["carda001"])
        }),
    );
    value["files"] = json!("not a list");
    fx.write_json(&value);
    let original = fx.bytes();

    let file = fx.apply_one(&Change::Rescan).unwrap();

    assert_eq!(file.files.len(), 1);
    assert_eq!(urls(&file), vec!["https://v/a"]);
    assert_eq!(file.trello_cards, vec![card("carda001")]);
    assert_eq!(fs::read(fx.backup()).unwrap(), original);
}

#[test]
fn b4_5_rescan_regenerates_a_file_that_is_not_json() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"])], 10);
    fx.write_raw("{ broken");

    let file = fx.apply_one(&Change::Rescan).unwrap();

    assert_eq!(file.project_title, "Proj");
    assert_eq!(fs::read(fx.backup()).unwrap(), b"{ broken");
}

#[test]
fn b4_6_rescan_creates_a_missing_file_from_the_folder() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"])], 10);

    let file = fx.apply_one(&Change::Rescan).unwrap();

    assert_eq!(file.project_title, "Proj");
    assert_eq!(file.created_by, "Baker");
    assert_eq!(file.parent_folder, fx.parent());
    assert!(fx.file().exists());
}

#[test]
fn b4_7_rescan_with_nothing_to_describe_fails_and_writes_nothing() {
    let fx = Fixture::bare();

    let result = fx.apply_one(&Change::Rescan);

    assert_eq!(result, Err(ChangeError::NothingToDescribe));
    assert!(!fx.file().exists());
}

// ---------------------------------------------------------------------------
// B5 - Refresh sizes
// ---------------------------------------------------------------------------

#[test]
fn b5_1_refresh_sizes_changes_only_size_and_timestamp() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"])], 300);
    fx.write_json(&well_formed(
        &fx,
        json!({
            "folderSizeBytes": 1,
            "videoLinks": links_json(&["https://v/a"]),
            "futureField": true
        }),
    ));
    let mut before = fx.on_disk();

    fx.apply_one(&Change::RefreshSizes).unwrap();

    let mut after = fx.on_disk();
    assert_eq!(after["folderSizeBytes"], 300);
    for value in [&mut before, &mut after] {
        let map = value.as_object_mut().unwrap();
        map.remove("folderSizeBytes");
        map.remove("lastModified");
    }
    assert_eq!(after, before);
}

// ---------------------------------------------------------------------------
// B6 - Video links and Trello cards
// ---------------------------------------------------------------------------

#[test]
fn b6_1_video_links_are_capped_at_the_limit() {
    let fx = Fixture::bare();
    let nineteen: Vec<String> = (0..19).map(|i| format!("https://v/{i}")).collect();
    let refs: Vec<&str> = nineteen.iter().map(String::as_str).collect();
    fx.write_json(&well_formed(
        &fx,
        json!({ "videoLinks": links_json(&refs) }),
    ));

    let file = fx
        .apply_one(&Change::AddVideoLink {
            link: link("https://v/19"),
        })
        .unwrap();
    assert_eq!(file.video_links.len(), MAX_VIDEO_LINKS);
    let full = fx.bytes();

    let result = fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/20"),
    });
    assert_eq!(
        result,
        Err(ChangeError::LimitReached {
            limit: MAX_VIDEO_LINKS
        })
    );
    assert_eq!(fx.bytes(), full);
}

#[test]
fn b6_2_trello_cards_are_capped_at_the_limit() {
    let fx = Fixture::bare();
    let fifty: Vec<String> = (0..50).map(|i| format!("card{i:04}")).collect();
    let refs: Vec<&str> = fifty.iter().map(String::as_str).collect();
    fx.write_json(&well_formed(
        &fx,
        json!({ "trelloCards": cards_json(&refs) }),
    ));
    let before = fx.bytes();

    let result = fx.apply_one(&Change::AddTrelloCard {
        card: card("cardnew1"),
    });

    assert_eq!(
        result,
        Err(ChangeError::LimitReached {
            limit: MAX_TRELLO_CARDS
        })
    );
    assert_eq!(fx.bytes(), before);
}

#[test]
fn b6_3_remove_video_link_drops_only_that_link() {
    let fx = linked_project();

    let file = fx.apply_one(&Change::RemoveVideoLink { index: 0 }).unwrap();

    assert_eq!(urls(&file), vec!["https://v/b"]);
    assert_eq!(file.trello_cards, vec![card("carda001")]);
}

#[test]
fn b6_3_reorder_video_links_moves_one_link() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({ "videoLinks": links_json(&["https://v/a", "https://v/b", "https://v/c"]) }),
    ));

    let file = fx
        .apply_one(&Change::ReorderVideoLinks { from: 0, to: 2 })
        .unwrap();

    assert_eq!(
        urls(&file),
        vec!["https://v/b", "https://v/c", "https://v/a"]
    );
}

#[test]
fn b6_3_remove_trello_card_drops_only_that_card() {
    let fx = Fixture::bare();
    fx.write_json(&well_formed(
        &fx,
        json!({
            "videoLinks": links_json(&["https://v/a"]),
            "trelloCards": cards_json(&["carda001", "cardb002"])
        }),
    ));

    let file = fx
        .apply_one(&Change::RemoveTrelloCard {
            card_id: "carda001".into(),
        })
        .unwrap();

    assert_eq!(file.trello_cards, vec![card("cardb002")]);
    assert_eq!(urls(&file), vec!["https://v/a"]);
}

#[test]
fn b6_3_missing_targets_fail_and_leave_the_file_alone() {
    let fx = linked_project();
    let before = fx.bytes();

    assert_eq!(
        fx.apply_one(&Change::RemoveVideoLink { index: 5 }),
        Err(ChangeError::IndexOutOfRange { index: 5 })
    );
    assert_eq!(
        fx.apply_one(&Change::ReorderVideoLinks { from: 0, to: 9 }),
        Err(ChangeError::IndexOutOfRange { index: 9 })
    );
    assert_eq!(
        fx.apply_one(&Change::RemoveTrelloCard {
            card_id: "nothere1".into()
        }),
        Err(ChangeError::CardNotLinked {
            card_id: "nothere1".into()
        })
    );
    assert_eq!(fx.bytes(), before);
}

#[test]
fn b6_3_link_changes_need_an_existing_file() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"])], 10);

    let result = fx.apply_one(&Change::AddVideoLink {
        link: link("https://v/1"),
    });

    assert_eq!(result, Err(ChangeError::NoBreadcrumbs));
    assert!(!fx.file().exists());
}

#[test]
fn b6_4_adding_an_already_linked_card_succeeds_without_change() {
    let fx = linked_project();
    let before = fx.bytes();

    let file = fx
        .apply_one(&Change::AddTrelloCard {
            card: card("carda001"),
        })
        .unwrap();

    assert_eq!(file.trello_cards, vec![card("carda001")]);
    assert_eq!(fx.bytes(), before);
}

#[test]
fn b6_5_update_video_link_checks_the_last_seen_url() {
    let fx = linked_project();

    let file = fx
        .apply_one(&Change::UpdateVideoLink {
            index: 1,
            expected_url: "https://v/b".into(),
            link: link("https://v/b2"),
        })
        .unwrap();
    assert_eq!(urls(&file), vec!["https://v/a", "https://v/b2"]);
    let current = fx.bytes();

    let stale = fx.apply_one(&Change::UpdateVideoLink {
        index: 1,
        expected_url: "https://v/b".into(),
        link: link("https://v/b3"),
    });
    assert_eq!(
        stale,
        Err(ChangeError::LinkChanged {
            expected_url: "https://v/b".into(),
            actual_url: "https://v/b2".into(),
        })
    );
    assert_eq!(fx.bytes(), current);
}

// ---------------------------------------------------------------------------
// B7 - Preview
// ---------------------------------------------------------------------------

/// `lastModified` is the only field allowed to differ between a preview and
/// the apply that follows it.
fn without_last_modified(mut file: Breadcrumbs) -> Breadcrumbs {
    file.last_modified = None;
    file
}

/// Preview, then apply, then read back what landed on disk.
fn assert_preview_matches_disk(name: &str, fx: &Fixture, change: &Change) {
    let previewed = preview(&[&fx.project], change).pop().unwrap();
    let applied = fx.apply_one(change);
    let (on_disk, _) = found(fx);

    match (previewed, applied) {
        (Ok(p), Ok(_)) => assert_eq!(
            without_last_modified(p.after),
            without_last_modified(on_disk),
            "preview disagrees with the file written for {name}"
        ),
        (p, a) => panic!("{name}: preview {p:?} vs apply {a:?}"),
    }
}

#[test]
fn b7_1_preview_after_equals_what_apply_writes_for_every_change() {
    for (name, change) in all_changes() {
        // A file that needs fixes, so preview must apply them too.
        let fx = linked_project();
        let mut value = fx.on_disk();
        value["createdBy"] = json!({ "data": "Alice" });
        value["trelloCardUrl"] = json!("https://trello.com/c/legacy01/p");
        fx.write_json(&value);
        assert_preview_matches_disk(name, &fx, &change);

        // A clean file, where nothing but the change itself differs.
        let clean = linked_project();
        assert_preview_matches_disk(name, &clean, &change);
    }
}

#[test]
fn b7_1_preview_of_a_no_op_equals_the_untouched_file() {
    let fx = linked_project();
    let change = Change::AddTrelloCard {
        card: card("carda001"),
    };

    let previewed = preview(&[&fx.project], &change).pop().unwrap().unwrap();
    let (on_disk, _) = found(&fx);

    assert_eq!(previewed.after, on_disk);
}

#[test]
fn b7_1_preview_of_create_equals_apply() {
    let fx = Fixture::with_footage(&[(1, &["a.mp4"]), (2, &[])], 10);
    let change = Change::Create {
        title: "T".into(),
        created_by: "Alice".into(),
    };

    let previewed = preview(&[&fx.project], &change).pop().unwrap().unwrap();
    let applied = fx.apply_one(&change).unwrap();

    let mut p = without_last_modified(previewed.after);
    let mut a = without_last_modified(applied);
    p.creation_date_time.clear();
    a.creation_date_time.clear();
    assert_eq!(p, a);
    assert_eq!(previewed.before, None);
}

#[test]
fn b7_2_preview_writes_nothing() {
    for (name, change) in all_changes() {
        let fx = linked_project();
        let mut value = fx.on_disk();
        value["createdBy"] = json!({ "data": "Alice" });
        fx.write_json(&value);
        let before = fx.bytes();

        let result = preview(&[&fx.project], &change).pop().unwrap();

        assert!(result.is_ok(), "{name}: {result:?}");
        assert_eq!(fx.bytes(), before, "{name} wrote the file");
        assert!(!fx.backup().exists(), "{name} wrote a backup");
    }
}

// ---------------------------------------------------------------------------
// B11.2 - Generated TypeScript is current
// ---------------------------------------------------------------------------

#[test]
fn b11_2_committed_typescript_bindings_are_current() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(BINDINGS_PATH);
    let generated = typescript_bindings();

    if std::env::var_os("UPDATE_BINDINGS").is_some() {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, &generated).unwrap();
        return;
    }

    let committed = fs::read_to_string(&path).unwrap_or_default();
    assert!(
        committed == generated,
        "{} is stale. Regenerate with: UPDATE_BINDINGS=1 cargo test b11_2",
        path.display()
    );
    assert!(generated.contains(&format!("MAX_VIDEO_LINKS = {MAX_VIDEO_LINKS}")));
    assert!(generated.contains(&format!("MAX_TRELLO_CARDS = {MAX_TRELLO_CARDS}")));
}
