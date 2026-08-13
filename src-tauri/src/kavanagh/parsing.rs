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
//!   suppresses it - the run then succeeds with nothing to parse.
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
    /// Frames in the stream, when ffprobe could count them.
    pub frame_count: Option<u64>,
    /// Frames per second, parsed from the `num/den` ffprobe prints.
    pub frame_rate: Option<f64>,
}

impl VideoProbe {
    /// Where the video actually ends, preferring `nb_frames / fps` over the
    /// container's duration field (A7).
    ///
    /// Not pedantry. One measured render reports a container duration of
    /// 166.633991s while its true end is 166.620s - 8331 frames at 50fps. The
    /// tail is measured backwards from the end, so a 14ms error is a systematic
    /// bias applied to every structural measurement: it puts a peak that is
    /// exactly at T-5.000s at T-5.014s instead. Falls back to the container
    /// value when either field is missing, which is the pre-A7 behaviour.
    pub fn end_seconds(&self) -> f64 {
        match (self.frame_count, self.frame_rate) {
            (Some(frames), Some(fps)) if frames > 0 && fps > 0.0 => frames as f64 / fps,
            _ => self.duration_seconds,
        }
    }
}

/// One frame's luma statistics, as `signalstats` reported them.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LumaSample {
    pub at_seconds: f64,
    /// Mean luma over the frame.
    pub yavg: f64,
    /// Darkest pixel in the frame.
    pub ymin: f64,
}

/// Parses a `signalstats,metadata=print` stream into per-frame luma samples.
///
/// The filter prints a frame header and then one `key=value` line per metadata
/// entry, so values are accumulated until the next header closes the frame:
///
/// ```text
/// frame:0    pts:0       pts_time:0
/// lavfi.signalstats.YAVG=16.5
/// lavfi.signalstats.YMIN=0
/// ```
///
/// A frame missing either statistic is dropped rather than defaulted. Zero is a
/// meaningful luma, so defaulting would invent a black frame, and a run of
/// invented black frames is exactly the shape of a dip to white's approach.
pub fn parse_signalstats(stdout: &str) -> Vec<LumaSample> {
    let mut samples = Vec::new();
    let mut at: Option<f64> = None;
    let mut yavg: Option<f64> = None;
    let mut ymin: Option<f64> = None;

    // Closes the frame currently being accumulated, if it is complete.
    fn flush(
        samples: &mut Vec<LumaSample>,
        at: Option<f64>,
        yavg: Option<f64>,
        ymin: Option<f64>,
    ) {
        if let (Some(at_seconds), Some(yavg), Some(ymin)) = (at, yavg, ymin) {
            samples.push(LumaSample {
                at_seconds,
                yavg,
                ymin,
            });
        }
    }

    for line in stdout.lines() {
        let line = line.trim();

        if let Some(rest) = line.strip_prefix("frame:") {
            flush(&mut samples, at, yavg, ymin);
            at = rest
                .split_whitespace()
                .find_map(|token| token.strip_prefix("pts_time:"))
                .and_then(|value| value.parse::<f64>().ok());
            yavg = None;
            ymin = None;
            continue;
        }

        let Some((key, value)) = line.split_once('=') else {
            continue;
        };

        match key.trim() {
            "lavfi.signalstats.YAVG" => yavg = value.trim().parse().ok(),
            "lavfi.signalstats.YMIN" => ymin = value.trim().parse().ok(),
            _ => {}
        }
    }

    flush(&mut samples, at, yavg, ymin);
    samples
}

/// Parses the `num/den` form ffprobe prints for a frame rate.
///
/// `0/0` appears for streams with no meaningful rate and must not become a
/// division by zero or an fps of zero.
fn parse_frame_rate(value: &str) -> Option<f64> {
    let (num, den) = value.split_once('/')?;
    let num: f64 = num.trim().parse().ok()?;
    let den: f64 = den.trim().parse().ok()?;

    (den > 0.0 && num > 0.0).then_some(num / den)
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
    let mut frame_count: Option<u64> = None;
    let mut frame_rate: Option<f64> = None;

    for line in stdout.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim();

        match key.trim() {
            "width" => width = value.parse().ok(),
            "height" => height = value.parse().ok(),
            // "N/A" is what ffprobe prints for a container with no duration, and
            // it must not become 0.0 - a zero duration would silently check
            // nothing and report a pass.
            "duration" => duration = value.parse().ok().filter(|d: &f64| *d > 0.0),
            // Both optional: a stream that cannot report them still gets checked,
            // just with the container duration as the end (see end_seconds).
            "nb_frames" => frame_count = value.parse().ok().filter(|f: &u64| *f > 0),
            "r_frame_rate" | "avg_frame_rate" => {
                frame_rate = frame_rate.or_else(|| parse_frame_rate(value))
            }
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
            frame_count,
            frame_rate,
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
                duration_seconds: 144.0,
                frame_count: None,
                frame_rate: None
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
        // `-select_streams v:0` selects nothing, so no stream entries are printed -
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

    #[test]
    fn reads_luma_statistics_per_frame_from_real_metadata_output() {
        // Verbatim from `signalstats,metadata=print:file=-`, with the entries
        // this does not read left in: the parser must skip them rather than be
        // confused by them.
        let stdout = "\
frame:0    pts:179200  pts_time:14
lavfi.signalstats.YMIN=8
lavfi.signalstats.YLOW=41
lavfi.signalstats.YAVG=125.865
lavfi.signalstats.YHIGH=209
frame:1    pts:179712  pts_time:14.04
lavfi.signalstats.YMIN=235
lavfi.signalstats.YAVG=235
";

        assert_eq!(
            parse_signalstats(stdout),
            vec![
                LumaSample {
                    at_seconds: 14.0,
                    yavg: 125.865,
                    ymin: 8.0
                },
                LumaSample {
                    at_seconds: 14.04,
                    yavg: 235.0,
                    ymin: 235.0
                }
            ]
        );
    }

    #[test]
    fn drops_a_frame_missing_a_statistic_rather_than_calling_it_black() {
        // Defaulting to 0 would invent a black frame, and a run of invented
        // black frames is the shape of a dip's approach.
        let stdout = "\
frame:0    pts:0  pts_time:1
lavfi.signalstats.YMIN=8
frame:1    pts:1  pts_time:2
lavfi.signalstats.YMIN=9
lavfi.signalstats.YAVG=100
";

        assert_eq!(
            parse_signalstats(stdout),
            vec![LumaSample {
                at_seconds: 2.0,
                yavg: 100.0,
                ymin: 9.0
            }]
        );
    }

    #[test]
    fn a7_prefers_the_frame_count_over_the_containers_duration() {
        // The measured case: a container claiming 166.633991s where 8331 frames
        // at 50fps put the true end at 166.62s. The tail is measured backwards
        // from the end, so the 14ms difference is a bias on every structural
        // measurement - it moves a peak that is exactly at T-5.000s to T-5.014s.
        let probe = VideoProbe {
            width: 3840,
            height: 2160,
            duration_seconds: 166.633991,
            frame_count: Some(8331),
            frame_rate: Some(50.0),
        };

        assert!((probe.end_seconds() - 166.62).abs() < 1e-9);
    }

    #[test]
    fn falls_back_to_the_container_duration_when_frames_cannot_be_counted() {
        let probe = VideoProbe {
            width: 1920,
            height: 1080,
            duration_seconds: 144.0,
            frame_count: None,
            frame_rate: Some(25.0),
        };

        assert_eq!(probe.end_seconds(), 144.0);
    }

    #[test]
    fn reads_the_frame_rate_ffprobe_prints_as_a_fraction() {
        let stdout =
            "width=1920\nheight=1080\nnb_frames=8331\nr_frame_rate=50/1\nduration=166.633991\n";
        let probe = parse_probe_output(stdout).expect("a probe");

        assert_eq!(probe.frame_rate, Some(50.0));
        assert_eq!(probe.frame_count, Some(8331));
    }

    #[test]
    fn a_zero_frame_rate_is_not_a_frame_rate() {
        // `0/0` is what ffprobe prints for a stream with no meaningful rate.
        let stdout = "width=1920\nheight=1080\nr_frame_rate=0/0\nduration=10.0\n";
        let probe = parse_probe_output(stdout).expect("a probe");

        assert_eq!(probe.frame_rate, None);
        assert_eq!(probe.end_seconds(), 10.0);
    }
}
