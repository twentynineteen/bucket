//! Video QC: ffmpeg toolchain discovery (issue #180, stage 1).
//!
//! ffmpeg is a system dependency rather than a bundled sidecar, so the app has
//! to find it. The one thing that must not be used here is `which`: a Tauri app
//! launched from Finder does not inherit the shell PATH, so `/opt/homebrew/bin`
//! is invisible to it even when ffmpeg is plainly installed. Absolute candidate
//! directories are probed instead.
//!
//! Both `ffmpeg` and `ffprobe` are required. Homebrew's formula ships both, but
//! reporting which one is missing is the difference between an actionable
//! message and "QC unavailable".

use serde::Serialize;
use std::path::{Path, PathBuf};

/// Directories probed when no custom directory is configured, in order.
///
/// `/opt/homebrew/bin` first: Apple Silicon Homebrew is the common case on the
/// team's machines, and it is precisely the one a Finder-launched PATH omits.
pub const DEFAULT_FFMPEG_DIRS: [&str; 3] = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

/// The binaries QC cannot run without.
pub const REQUIRED_BINARIES: [&str; 2] = ["ffmpeg", "ffprobe"];

/// What probing one candidate binary path found.
///
/// `NotExecutable` is kept apart from `Absent` because the two have different
/// fixes: one is "install ffmpeg", the other is "fix the permissions on the
/// file you pointed me at".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProbeOutcome {
    Executable,
    NotExecutable,
    Absent,
}

/// Where QC stands on being able to run ffmpeg at all.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum FfmpegAvailability {
    /// Both binaries found and runnable.
    Ready { ffmpeg: String, ffprobe: String },
    /// One or both binaries were absent everywhere we looked. `missing` names
    /// them so the UI can say which to install; `searched` lists where we tried.
    NotFound {
        missing: Vec<String>,
        searched: Vec<String>,
    },
    /// A binary is present but cannot be executed.
    NotExecutable { path: String },
}

/// Resolves the ffmpeg toolchain, given a way to probe candidate paths.
///
/// The probe is injected so the resolution order and the reporting can be
/// tested without a filesystem: the interesting behaviour here is entirely in
/// *which* paths are consulted and in what is reported, not in the stat call.
///
/// A configured `custom_dir` is authoritative. If it is set but does not yield
/// both binaries, that is reported rather than quietly falling through to the
/// system directories — silently ignoring an explicit setting is how you get a
/// user insisting they configured something that never took effect.
pub fn resolve_ffmpeg_tools<P>(custom_dir: Option<&str>, probe: P) -> FfmpegAvailability
where
    P: Fn(&Path) -> ProbeOutcome,
{
    let search_dirs: Vec<String> = match custom_dir {
        Some(dir) => vec![dir.to_string()],
        None => DEFAULT_FFMPEG_DIRS.iter().map(|d| d.to_string()).collect(),
    };

    // Resolve each binary independently: a directory holding only ffmpeg should
    // not stop us finding ffprobe in the next one, and `missing` has to name
    // exactly which binary the user needs to install.
    let mut found: Vec<(&str, Option<String>)> = Vec::with_capacity(REQUIRED_BINARIES.len());

    // A binary that is present but unrunnable, remembered rather than returned
    // at once. A broken ffmpeg in Homebrew must not hide a working one in
    // /usr/local/bin, but if nothing runnable turns up anywhere then this is a
    // far more useful thing to report than "not found".
    let mut unrunnable: Option<String> = None;

    for binary in REQUIRED_BINARIES {
        let mut resolved: Option<String> = None;

        for dir in &search_dirs {
            let candidate = candidate_path(dir, binary);
            match probe(&candidate) {
                ProbeOutcome::Executable => {
                    resolved = Some(candidate.to_string_lossy().to_string());
                    break;
                }
                ProbeOutcome::NotExecutable => {
                    let path = candidate.to_string_lossy().to_string();

                    // A configured directory is authoritative, so a broken
                    // binary in it is the answer, not a reason to look elsewhere.
                    if custom_dir.is_some() {
                        return FfmpegAvailability::NotExecutable { path };
                    }

                    unrunnable.get_or_insert(path);
                    continue;
                }
                ProbeOutcome::Absent => continue,
            }
        }

        found.push((binary, resolved));
    }

    let missing: Vec<String> = found
        .iter()
        .filter(|(_, resolved)| resolved.is_none())
        .map(|(binary, _)| (*binary).to_string())
        .collect();

    if !missing.is_empty() {
        // "Fix the permissions" beats "install it" whenever a copy is sitting
        // there, even if the search also came up empty elsewhere.
        if let Some(path) = unrunnable {
            return FfmpegAvailability::NotExecutable { path };
        }

        return FfmpegAvailability::NotFound {
            missing,
            searched: search_dirs,
        };
    }

    // Looked up by name rather than by position, so adding a third required
    // binary cannot silently pair the wrong path with the wrong slot.
    let path_of = |name: &str| -> String {
        found
            .iter()
            .find(|(binary, _)| *binary == name)
            .and_then(|(_, resolved)| resolved.clone())
            .unwrap_or_default()
    };

    FfmpegAvailability::Ready {
        ffmpeg: path_of("ffmpeg"),
        ffprobe: path_of("ffprobe"),
    }
}

/// Probes a real path on disk: present, and executable by us?
#[cfg(unix)]
pub fn probe_binary_path(path: &Path) -> ProbeOutcome {
    use std::os::unix::fs::PermissionsExt;

    match std::fs::metadata(path) {
        Ok(meta) => {
            if !meta.is_file() {
                return ProbeOutcome::Absent;
            }
            // Any execute bit is enough: we do not know which of owner/group/other
            // we are, and a false "executable" fails later with ffmpeg's own error.
            if meta.permissions().mode() & 0o111 != 0 {
                ProbeOutcome::Executable
            } else {
                ProbeOutcome::NotExecutable
            }
        }
        Err(_) => ProbeOutcome::Absent,
    }
}

/// Probes a real path on disk. Windows has no execute bit, so presence is all
/// that can be checked; a non-runnable binary surfaces as an ffmpeg error later.
#[cfg(not(unix))]
pub fn probe_binary_path(path: &Path) -> ProbeOutcome {
    match std::fs::metadata(path) {
        Ok(meta) if meta.is_file() => ProbeOutcome::Executable,
        _ => ProbeOutcome::Absent,
    }
}

/// Reports whether QC can run ffmpeg, and where the binaries are.
///
/// `custom_dir` is the directory configured in Settings, when the user has set
/// one; passing `None` searches the standard locations.
#[tauri::command]
pub fn qc_detect_ffmpeg(custom_dir: Option<String>) -> FfmpegAvailability {
    resolve_ffmpeg_tools(custom_dir.as_deref(), probe_binary_path)
}

/// Joins a directory and binary name into a candidate path.
pub fn candidate_path(dir: &str, binary: &str) -> PathBuf {
    Path::new(dir).join(binary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// Builds a probe over a fixed map of path -> outcome. Anything not in the
    /// map is absent, which is what a real filesystem would say too.
    fn probe_from(entries: &[(&str, ProbeOutcome)]) -> impl Fn(&Path) -> ProbeOutcome {
        let map: HashMap<String, ProbeOutcome> = entries
            .iter()
            .map(|(p, o)| ((*p).to_string(), *o))
            .collect();
        move |path: &Path| {
            map.get(&path.to_string_lossy().to_string())
                .copied()
                .unwrap_or(ProbeOutcome::Absent)
        }
    }

    #[test]
    fn b1_1_prefers_a_configured_custom_directory() {
        // Both a custom directory and Homebrew have a working toolchain. The
        // custom one must win, or the setting is decorative.
        let probe = probe_from(&[
            ("/custom/tools/ffmpeg", ProbeOutcome::Executable),
            ("/custom/tools/ffprobe", ProbeOutcome::Executable),
            ("/opt/homebrew/bin/ffmpeg", ProbeOutcome::Executable),
            ("/opt/homebrew/bin/ffprobe", ProbeOutcome::Executable),
        ]);

        let result = resolve_ffmpeg_tools(Some("/custom/tools"), probe);

        assert_eq!(
            result,
            FfmpegAvailability::Ready {
                ffmpeg: "/custom/tools/ffmpeg".to_string(),
                ffprobe: "/custom/tools/ffprobe".to_string(),
            }
        );
    }

    #[test]
    fn b1_2_finds_homebrew_without_consulting_the_path() {
        // The whole point: a Finder-launched app has no /opt/homebrew/bin in
        // PATH. Discovery must not depend on it.
        let probe = probe_from(&[
            ("/opt/homebrew/bin/ffmpeg", ProbeOutcome::Executable),
            ("/opt/homebrew/bin/ffprobe", ProbeOutcome::Executable),
        ]);

        let result = resolve_ffmpeg_tools(None, probe);

        assert_eq!(
            result,
            FfmpegAvailability::Ready {
                ffmpeg: "/opt/homebrew/bin/ffmpeg".to_string(),
                ffprobe: "/opt/homebrew/bin/ffprobe".to_string(),
            }
        );
    }

    #[test]
    fn b1_2_searches_later_directories_when_homebrew_is_absent() {
        let probe = probe_from(&[
            ("/usr/local/bin/ffmpeg", ProbeOutcome::Executable),
            ("/usr/local/bin/ffprobe", ProbeOutcome::Executable),
        ]);

        let result = resolve_ffmpeg_tools(None, probe);

        assert_eq!(
            result,
            FfmpegAvailability::Ready {
                ffmpeg: "/usr/local/bin/ffmpeg".to_string(),
                ffprobe: "/usr/local/bin/ffprobe".to_string(),
            }
        );
    }

    #[test]
    fn b1_3_names_ffprobe_when_only_ffmpeg_is_installed() {
        let probe = probe_from(&[("/opt/homebrew/bin/ffmpeg", ProbeOutcome::Executable)]);

        let result = resolve_ffmpeg_tools(None, probe);

        match result {
            FfmpegAvailability::NotFound { missing, .. } => {
                assert_eq!(
                    missing,
                    vec!["ffprobe".to_string()],
                    "ffmpeg was present, so only ffprobe should be reported missing"
                );
            }
            other => panic!("expected NotFound, got {:?}", other),
        }
    }

    #[test]
    fn b1_4_names_both_binaries_when_nothing_is_installed() {
        let probe = probe_from(&[]);

        let result = resolve_ffmpeg_tools(None, probe);

        match result {
            FfmpegAvailability::NotFound { missing, searched } => {
                assert_eq!(missing, vec!["ffmpeg".to_string(), "ffprobe".to_string()]);
                assert_eq!(
                    searched,
                    DEFAULT_FFMPEG_DIRS
                        .iter()
                        .map(|d| d.to_string())
                        .collect::<Vec<_>>(),
                    "the report should say where we looked, so the user can point us elsewhere"
                );
            }
            other => panic!("expected NotFound, got {:?}", other),
        }
    }

    #[test]
    fn b1_5_keeps_searching_past_an_unrunnable_binary_in_a_system_dir() {
        // A broken ffmpeg in Homebrew must not hide a working one in
        // /usr/local/bin. Reporting NotExecutable here would send the user to
        // fix a binary they do not need.
        let probe = probe_from(&[
            ("/opt/homebrew/bin/ffmpeg", ProbeOutcome::NotExecutable),
            ("/usr/local/bin/ffmpeg", ProbeOutcome::Executable),
            ("/usr/local/bin/ffprobe", ProbeOutcome::Executable),
        ]);

        let result = resolve_ffmpeg_tools(None, probe);

        assert_eq!(
            result,
            FfmpegAvailability::Ready {
                ffmpeg: "/usr/local/bin/ffmpeg".to_string(),
                ffprobe: "/usr/local/bin/ffprobe".to_string(),
            }
        );
    }

    #[test]
    fn b1_5_reports_unrunnable_rather_than_missing_when_no_dir_has_a_working_copy() {
        // Nothing runnable anywhere, but a binary is plainly sitting there.
        // "Install ffmpeg" is the wrong instruction, so the permissions problem
        // must survive the wider search rather than collapsing into NotFound.
        let probe = probe_from(&[
            ("/opt/homebrew/bin/ffmpeg", ProbeOutcome::NotExecutable),
            ("/opt/homebrew/bin/ffprobe", ProbeOutcome::Executable),
        ]);

        let result = resolve_ffmpeg_tools(None, probe);

        assert_eq!(
            result,
            FfmpegAvailability::NotExecutable {
                path: "/opt/homebrew/bin/ffmpeg".to_string()
            }
        );
    }

    #[test]
    fn b1_5_reports_a_present_but_unrunnable_binary_distinctly() {
        // "Fix the permissions" is a different instruction from "install it",
        // so this must not collapse into NotFound.
        let probe = probe_from(&[
            ("/custom/tools/ffmpeg", ProbeOutcome::NotExecutable),
            ("/custom/tools/ffprobe", ProbeOutcome::Executable),
        ]);

        let result = resolve_ffmpeg_tools(Some("/custom/tools"), probe);

        assert_eq!(
            result,
            FfmpegAvailability::NotExecutable {
                path: "/custom/tools/ffmpeg".to_string()
            }
        );
    }

    #[test]
    fn b1_1_does_not_fall_back_to_system_dirs_from_a_broken_custom_dir() {
        // Falling through would make the app work while the user's explicit
        // setting silently did nothing.
        let probe = probe_from(&[
            ("/opt/homebrew/bin/ffmpeg", ProbeOutcome::Executable),
            ("/opt/homebrew/bin/ffprobe", ProbeOutcome::Executable),
        ]);

        let result = resolve_ffmpeg_tools(Some("/custom/tools"), probe);

        match result {
            FfmpegAvailability::NotFound { missing, searched } => {
                assert_eq!(missing, vec!["ffmpeg".to_string(), "ffprobe".to_string()]);
                assert_eq!(
                    searched,
                    vec!["/custom/tools".to_string()],
                    "only the configured directory should have been searched"
                );
            }
            other => panic!("expected NotFound for the custom dir, got {:?}", other),
        }
    }

    /// Not a behaviour test: this guards the serde tag against the frontend's
    /// mirror type in `src/features/QualityControl/types.ts`. It passes on a
    /// derive alone, and is named so nobody mistakes it for covering B1.4.
    #[test]
    fn serde_tags_match_the_frontend_mirror_type() {
        let json = serde_json::to_string(&FfmpegAvailability::NotFound {
            missing: vec!["ffprobe".to_string()],
            searched: vec!["/opt/homebrew/bin".to_string()],
        })
        .unwrap();

        assert!(json.contains("\"status\":\"notFound\""), "got {}", json);
        assert!(json.contains("ffprobe"), "got {}", json);
    }
}
