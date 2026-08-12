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
    let _ = (custom_dir, probe);
    todo!("stage 1 implementation")
}

/// Probes a real path on disk: present, and executable by us?
pub fn probe_binary_path(path: &Path) -> ProbeOutcome {
    let _ = path;
    todo!("stage 1 implementation")
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

    #[test]
    fn b1_4_serialises_for_the_frontend_with_a_status_tag() {
        let json = serde_json::to_string(&FfmpegAvailability::NotFound {
            missing: vec!["ffprobe".to_string()],
            searched: vec!["/opt/homebrew/bin".to_string()],
        })
        .unwrap();

        assert!(json.contains("\"status\":\"notFound\""), "got {}", json);
        assert!(json.contains("ffprobe"), "got {}", json);
    }
}
