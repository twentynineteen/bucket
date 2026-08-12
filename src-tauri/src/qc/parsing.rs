//! Parsing ffmpeg and ffprobe output (issue #180, stage 2, B12).
//!
//! Two things are read out of ffmpeg's own reporting rather than assumed:
//!
//! - **`pts_time` from `showinfo`**, so every timestamp in a report is the time
//!   ffmpeg actually decoded a frame at. Assuming a seek landed where it was
//!   asked to would make gap boundaries wrong by up to a keyframe interval,
//!   which on a long GOP is seconds.
//! - **The alpha bounding box from `bbox`**, which is how a reference's watermark
//!   region is located. `bbox` logs at *info* level, so `-v error` silently
//!   suppresses it — the run then succeeds with nothing to parse.
//!
//! Both filters write to stderr, which is also where an ffmpeg failure explains
//! itself, so all of this is parsed out of one stream.

use super::geometry::AlphaBbox;

/// Extracts `pts_time` values from `showinfo` lines, in the order printed.
///
/// Order is the pairing with decoded frames: `showinfo` prints one line per frame
/// as it passes, so the nth line belongs to the nth frame read off stdout.
/// Anything unparseable is skipped rather than defaulting to zero, which would
/// silently shift every later frame's timestamp.
pub fn parse_showinfo_times(stderr: &str) -> Vec<f64> {
    stderr
        .lines()
        .filter(|line| line.contains("pts_time:"))
        .filter_map(|line| {
            let rest = line.split("pts_time:").nth(1)?;
            let value: String = rest
                .chars()
                .take_while(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
                .collect();
            value.parse::<f64>().ok()
        })
        .collect()
}

/// Reads the alpha bounding box out of the `bbox` filter's log line.
///
/// Returns `None` when the filter reported no box, which is what a reference with
/// a fully transparent (or fully opaque, with `min_val` unmet) alpha channel
/// produces. That is a reference QC cannot use, and it must be distinguishable
/// from a parse failure.
pub fn parse_alpha_bbox(stderr: &str) -> Option<AlphaBbox> {
    stderr
        .lines()
        .filter(|line| line.contains("x1:") && line.contains("y2:"))
        .filter_map(|line| {
            Some(AlphaBbox {
                x1: field(line, "x1:")?,
                y1: field(line, "y1:")?,
                x2: field(line, "x2:")?,
                y2: field(line, "y2:")?,
            })
        })
        .next()
}

/// Reads the frame size out of a `showinfo` line, as `(width, height)`.
///
/// Used to learn a reference image's own dimensions from the same call that
/// measures its alpha bbox, rather than spawning ffprobe again for two numbers.
pub fn parse_showinfo_size(stderr: &str) -> Option<(u32, u32)> {
    stderr
        .lines()
        .filter(|line| line.contains(" s:"))
        .filter_map(|line| {
            let rest = line.split(" s:").nth(1)?;
            let dimensions: String = rest
                .chars()
                .take_while(|c| c.is_ascii_digit() || *c == 'x')
                .collect();
            let (w, h) = dimensions.split_once('x')?;
            Some((w.parse().ok()?, h.parse().ok()?))
        })
        .next()
}

/// Reads one `key:value` field out of a filter log line.
fn field(line: &str, key: &str) -> Option<u32> {
    let rest = line.split(key).nth(1)?;
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse::<u32>().ok()
}

/// What ffprobe reported about a video file.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VideoProbe {
    pub width: u32,
    pub height: u32,
    pub duration_seconds: f64,
}

/// Why a file cannot be analysed, in the operator's terms.
///
/// Each variant is a different instruction, which is the entire point of not
/// collapsing them into "could not read the video" (B12.1, B12.3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProbeProblem {
    MissingVideoStream,
    UnreadableDimensions,
    MissingDuration,
}

impl ProbeProblem {
    pub fn message(&self) -> &'static str {
        match self {
            ProbeProblem::MissingVideoStream => {
                "This file has no video stream, so there is nothing to check."
            }
            ProbeProblem::UnreadableDimensions => {
                "ffprobe could not read this video's dimensions, so the watermark region cannot be located."
            }
            ProbeProblem::MissingDuration => {
                "ffprobe could not read a duration for this video, so the checked span cannot be worked out."
            }
        }
    }
}

/// Parses `ffprobe -show_entries stream=width,height:format=duration` output.
///
/// The `key=value` form is parsed rather than JSON so no serde shape has to be
/// maintained for three numbers.
pub fn parse_probe_output(stdout: &str) -> Result<VideoProbe, ProbeProblem> {
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;
    let mut duration: Option<f64> = None;

    for line in stdout.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim();

        match key.trim() {
            "width" => width = value.parse().ok(),
            "height" => height = value.parse().ok(),
            // "N/A" is what ffprobe prints for a container with no duration, and
            // it must not become 0.0 — a zero duration would silently check
            // nothing and report a pass.
            "duration" => duration = value.parse().ok().filter(|d: &f64| *d > 0.0),
            _ => {}
        }
    }

    // No stream fields at all means `-select_streams v:0` selected nothing, which is
    // a file with no video stream. An audio-only file still reports a container
    // duration, so the duration must not be part of that judgement (B12.1).
    if width.is_none() && height.is_none() {
        return Err(ProbeProblem::MissingVideoStream);
    }

    match (width, height, duration) {
        (Some(w), Some(h), Some(d)) if w > 0 && h > 0 => Ok(VideoProbe {
            width: w,
            height: h,
            duration_seconds: d,
        }),
        (_, _, None) => Err(ProbeProblem::MissingDuration),
        _ => Err(ProbeProblem::UnreadableDimensions),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_pts_times_in_the_order_printed() {
        // Real showinfo output, trimmed. The frame index and pts_time both appear,
        // and only pts_time may be trusted as a time.
        let stderr = "\
[Parsed_showinfo_5 @ 0x600] n:0 pts:0 pts_time:0 duration:1 fmt:gray
[Parsed_showinfo_5 @ 0x600] n:1 pts:20480 pts_time:2.5 duration:1 fmt:gray
[Parsed_showinfo_5 @ 0x600] n:2 pts:40960 pts_time:5.0 duration:1 fmt:gray
frame=3 fps=0.0 q=-0.0 Lsize=N/A time=00:00:05.00";

        assert_eq!(parse_showinfo_times(stderr), vec![0.0, 2.5, 5.0]);
    }

    #[test]
    fn ignores_a_malformed_time_rather_than_defaulting_it_to_zero() {
        // A zero would shift every later frame's timestamp and put a gap in the
        // wrong place, which is worse than one missing sample.
        let stderr = "\
[showinfo] n:0 pts_time:1.0
[showinfo] n:1 pts_time:notanumber
[showinfo] n:2 pts_time:3.0";

        assert_eq!(parse_showinfo_times(stderr), vec![1.0, 3.0]);
    }

    #[test]
    fn reads_the_alpha_bbox_from_the_filter_log() {
        // Verified against ffmpeg 8.1.2, which appends ready-made crop and drawbox
        // strings after the fields.
        let stderr = "[Parsed_bbox_1 @ 0x6000] n:0 pts:0 pts_time:0 x1:1751 x2:1898 y1:20 y2:167 w:148 h:148 crop=148:148:1751:20 drawbox=1751:20:148:148";

        assert_eq!(
            parse_alpha_bbox(stderr),
            Some(AlphaBbox {
                x1: 1751,
                y1: 20,
                x2: 1898,
                y2: 167
            })
        );
    }

    #[test]
    fn reads_a_reference_own_dimensions_from_the_same_showinfo_line() {
        // The reference's dimensions are what its bbox is scaled *from*, so they
        // have to come out of the same call rather than a second ffprobe spawn.
        let stderr = "[Parsed_showinfo_2 @ 0x600] n:0 pts:0 pts_time:0 duration:1 fmt:gray sar:1/1 s:1920x1080 i:P iskey:1";

        assert_eq!(parse_showinfo_size(stderr), Some((1920, 1080)));
    }

    #[test]
    fn reports_no_bbox_when_the_filter_found_no_opaque_pixels() {
        // A fully transparent reference. bbox prints the frame header and nothing
        // else, and that has to be distinguishable from a parse failure.
        let stderr = "[Parsed_bbox_1 @ 0x6000] n:0 pts:0 pts_time:0";

        assert_eq!(parse_alpha_bbox(stderr), None);
    }

    #[test]
    fn b12_4_reads_dimensions_and_duration_for_a_vertical_video() {
        let stdout = "width=1080\nheight=1920\nduration=144.000000\n";

        assert_eq!(
            parse_probe_output(stdout),
            Ok(VideoProbe {
                width: 1080,
                height: 1920,
                duration_seconds: 144.0
            })
        );
    }

    #[test]
    fn b12_1_reports_no_video_stream_when_ffprobe_printed_nothing() {
        assert_eq!(
            parse_probe_output("\n"),
            Err(ProbeProblem::MissingVideoStream)
        );
    }

    #[test]
    fn b12_1_reports_no_video_stream_for_an_audio_only_file() {
        // `-select_streams v:0` selects nothing, so no stream entries are printed —
        // but the container still reports a duration. Judging on the duration would
        // classify this as a dimensions problem and tell the operator to check the
        // wrong thing.
        let stdout = "duration=12.000000\n";

        assert_eq!(
            parse_probe_output(stdout),
            Err(ProbeProblem::MissingVideoStream)
        );
    }

    #[test]
    fn b12_3_reports_a_missing_duration_distinctly() {
        let stdout = "width=1920\nheight=1080\nduration=N/A\n";

        assert_eq!(
            parse_probe_output(stdout),
            Err(ProbeProblem::MissingDuration)
        );
    }

    #[test]
    fn b12_3_treats_a_zero_duration_as_no_duration() {
        // A zero would check nothing and report a pass, which is the worst
        // possible outcome for a QC tool.
        let stdout = "width=1920\nheight=1080\nduration=0.000000\n";

        assert_eq!(
            parse_probe_output(stdout),
            Err(ProbeProblem::MissingDuration)
        );
    }

    #[test]
    fn reports_missing_dimensions_distinctly_from_a_missing_stream() {
        // A video stream ffprobe could see but not fully describe.
        let stdout = "width=1920\nduration=12.0\n";

        assert_eq!(
            parse_probe_output(stdout),
            Err(ProbeProblem::UnreadableDimensions)
        );
    }
}
