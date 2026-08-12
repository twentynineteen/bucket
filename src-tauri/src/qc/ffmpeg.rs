//! Running ffmpeg (issue #180, stage 2, B11).
//!
//! Three properties this module exists to guarantee:
//!
//! 1. **Cancellation kills the child.** A QC run spawns a decoder that can chew
//!    through a two-hour render; abandoning the handle would leave it running
//!    after the operator has moved on (B11.2).
//! 2. **stderr is bounded but its useful part survives.** ffmpeg explains its
//!    failures on stderr and can print a warning per frame, so the *tail* is kept
//!    to a byte budget while the timestamps `showinfo` prints are parsed out of
//!    the stream as it arrives and kept separately (B11.3).
//! 3. **Frames are streamed, never buffered.** A UHD render sampled every ten
//!    seconds produces hundreds of ~170KB crops; collecting them all before
//!    scoring any would hold a hundred megabytes for no reason.
//!
//! Both pipes are drained on their own threads. Reading one to completion before
//! the other deadlocks as soon as ffmpeg fills the pipe it is not being read
//! from, which for a long run it always does.

use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tokio::sync::watch;

use super::parsing::parse_showinfo_times;
use super::thresholds::MAX_STDERR_BYTES;

/// How long to wait between cancellation checks while a short command runs.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// What running ffmpeg produced.
#[derive(Debug, Clone)]
pub struct FfmpegRun {
    /// Frames handed to the callback, or raw stdout for a capture run.
    pub frames_read: usize,
    /// `pts_time` values in the order `showinfo` printed them.
    pub pts_times: Vec<f64>,
    /// The tail of stderr, size-limited.
    pub stderr_tail: String,
    pub exit_ok: bool,
}

/// Why running ffmpeg did not produce a result.
#[derive(Debug, Clone)]
pub enum RunError {
    /// The binary could not be started at all.
    Spawn(String),
    /// The operator cancelled; the child was killed.
    Cancelled,
    /// Reading a pipe failed part-way through.
    Io(String),
}

/// Collects stderr into a byte-bounded tail while parsing timestamps out of it.
///
/// Keeping whole lines rather than a byte ring means the tail never starts
/// mid-character and never mid-message, so what is shown to an operator is
/// always something ffmpeg actually said.
struct StderrCollector {
    lines: VecDeque<String>,
    bytes: usize,
    pts_times: Vec<f64>,
}

impl StderrCollector {
    fn new() -> Self {
        Self {
            lines: VecDeque::new(),
            bytes: 0,
            pts_times: Vec::new(),
        }
    }

    fn push(&mut self, line: String) {
        // Parsed on the way past: the timestamps are needed in full however long
        // the run is, and they are a few bytes each rather than a log line.
        self.pts_times.extend(parse_showinfo_times(&line));

        self.bytes += line.len() + 1;
        self.lines.push_back(line);

        while self.bytes > MAX_STDERR_BYTES {
            match self.lines.pop_front() {
                Some(dropped) => self.bytes -= dropped.len() + 1,
                None => break,
            }
        }
    }

    fn finish(self) -> (String, Vec<f64>) {
        (
            self.lines.into_iter().collect::<Vec<_>>().join("\n"),
            self.pts_times,
        )
    }
}

/// Spawns ffmpeg with both pipes captured.
fn spawn(bin: &str, args: &[String]) -> Result<Child, RunError> {
    Command::new(bin)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| RunError::Spawn(format!("Could not run {}: {}", bin, e)))
}

/// Starts draining stderr on its own thread.
fn drain_stderr(child: &mut Child) -> mpsc::Receiver<(String, Vec<f64>)> {
    let (tx, rx) = mpsc::channel();
    let stderr = child.stderr.take();

    thread::spawn(move || {
        let mut collector = StderrCollector::new();
        if let Some(stderr) = stderr {
            for line in BufReader::new(stderr).lines() {
                match line {
                    Ok(line) => collector.push(line),
                    Err(_) => break,
                }
            }
        }
        let _ = tx.send(collector.finish());
    });

    rx
}

/// Kills the child and reaps it, so nothing is left orphaned (B11.2).
fn terminate(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

/// Runs ffmpeg writing fixed-size rawvideo frames to stdout, calling `on_frame`
/// for each complete frame as it arrives.
///
/// The frame size is exact and known from the filter graph, so frame boundaries
/// need no framing metadata: reading `frame_size` bytes is reading one frame. A
/// trailing partial frame is discarded — it means the process was cut short, and
/// scoring a half-decoded frame would invent a failure.
pub fn run_frames<F>(
    bin: &str,
    args: &[String],
    frame_size: usize,
    cancel: &watch::Receiver<bool>,
    mut on_frame: F,
) -> Result<FfmpegRun, RunError>
where
    F: FnMut(usize, &[u8]),
{
    unimplemented!("red");
    if frame_size == 0 {
        return Err(RunError::Io("A frame cannot be zero bytes".to_string()));
    }

    let mut child = spawn(bin, args)?;
    let stderr_rx = drain_stderr(&mut child);
    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| RunError::Io("ffmpeg produced no stdout pipe".to_string()))?;

    let mut buffer = vec![0u8; frame_size];
    let mut frames_read = 0usize;

    loop {
        if *cancel.borrow() {
            terminate(&mut child);
            return Err(RunError::Cancelled);
        }

        match read_exact_or_eof(&mut stdout, &mut buffer) {
            Ok(0) => break,
            Ok(n) if n == frame_size => {
                on_frame(frames_read, &buffer);
                frames_read += 1;
            }
            // A short read at the end of the stream: the process was cut off.
            Ok(_) => break,
            Err(e) => {
                terminate(&mut child);
                return Err(RunError::Io(e));
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| RunError::Io(format!("Waiting for ffmpeg failed: {}", e)))?;

    let (stderr_tail, pts_times) = stderr_rx.recv().unwrap_or_default();

    Ok(FfmpegRun {
        frames_read,
        pts_times,
        stderr_tail,
        exit_ok: status.success(),
    })
}

/// Reads until the buffer is full or the stream ends, returning how many bytes
/// were read. `Read::read` is free to return fewer bytes than asked for on a
/// pipe, so a single call per frame would mis-frame the stream.
fn read_exact_or_eof(source: &mut impl Read, buffer: &mut [u8]) -> Result<usize, String> {
    unimplemented!("red");
    let mut filled = 0usize;
    while filled < buffer.len() {
        match source.read(&mut buffer[filled..]) {
            Ok(0) => break,
            Ok(n) => filled += n,
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(format!("Reading ffmpeg output failed: {}", e)),
        }
    }
    Ok(filled)
}

/// Runs ffmpeg or ffprobe and captures all of stdout.
///
/// For the short commands whose whole output is the answer: an ffprobe dump, a
/// reference's pixels, one JPEG thumbnail. Cancellation is still honoured, since
/// a run cancelled during the thumbnail phase should not have to wait for it.
pub fn run_capture(
    bin: &str,
    args: &[String],
    cancel: &watch::Receiver<bool>,
) -> Result<(Vec<u8>, FfmpegRun), RunError> {
    unimplemented!("red");
    let mut child = spawn(bin, args)?;
    let stderr_rx = drain_stderr(&mut child);

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| RunError::Io("ffmpeg produced no stdout pipe".to_string()))?;

    let (stdout_tx, stdout_rx) = mpsc::channel();
    thread::spawn(move || {
        let mut bytes = Vec::new();
        let mut reader = BufReader::new(stdout);
        let result = reader.read_to_end(&mut bytes).map(|_| bytes);
        let _ = stdout_tx.send(result);
    });

    // Polled rather than blocked on, so a cancellation during a slow decode is
    // acted on instead of being noticed once the process has finished anyway.
    let status = loop {
        if *cancel.borrow() {
            terminate(&mut child);
            return Err(RunError::Cancelled);
        }

        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => thread::sleep(POLL_INTERVAL),
            Err(e) => {
                terminate(&mut child);
                return Err(RunError::Io(format!("Waiting for ffmpeg failed: {}", e)));
            }
        }
    };

    let stdout_bytes = match stdout_rx.recv() {
        Ok(Ok(bytes)) => bytes,
        Ok(Err(e)) => return Err(RunError::Io(format!("Reading ffmpeg output failed: {}", e))),
        Err(_) => Vec::new(),
    };

    let (stderr_tail, pts_times) = stderr_rx.recv().unwrap_or_default();

    Ok((
        stdout_bytes.clone(),
        FfmpegRun {
            frames_read: 0,
            pts_times,
            stderr_tail,
            exit_ok: status.success(),
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn b11_3_keeps_the_tail_of_stderr_within_the_byte_budget() {
        let mut collector = StderrCollector::new();

        // A per-frame warning, repeated until well past the budget. The useful
        // part of an ffmpeg failure is always the last thing it said.
        for i in 0..4000 {
            collector.push(format!("[libx264 @ 0x600] warning number {}", i));
        }
        collector.push("Conversion failed!".to_string());

        let (tail, _) = collector.finish();

        assert!(
            tail.len() <= MAX_STDERR_BYTES,
            "stderr tail grew to {} bytes",
            tail.len()
        );
        assert!(
            tail.contains("Conversion failed!"),
            "the final message must survive the truncation"
        );
        assert!(
            !tail.contains("warning number 0"),
            "the oldest lines are the ones to drop"
        );
    }

    #[test]
    fn timestamps_survive_a_stderr_flood_that_exceeds_the_budget() {
        // The timestamps are parsed on the way past precisely so that a long run's
        // showinfo output is not lost to the size limit along with the noise.
        let mut collector = StderrCollector::new();

        for i in 0..2000 {
            collector.push(format!("[Parsed_showinfo_5 @ 0x1] n:{i} pts_time:{}", i));
        }

        let (tail, times) = collector.finish();

        assert!(tail.len() <= MAX_STDERR_BYTES);
        assert_eq!(times.len(), 2000, "every frame's timestamp must survive");
        assert_eq!(times[0], 0.0);
    }

    #[test]
    fn reports_a_missing_binary_as_a_spawn_failure() {
        let (_, cancel) = watch::channel(false);

        let result = run_frames(
            "/definitely/not/a/real/ffmpeg",
            &["-version".to_string()],
            16,
            &cancel,
            |_, _| {},
        );

        match result {
            Err(RunError::Spawn(message)) => assert!(message.contains("Could not run")),
            other => panic!("expected a spawn failure, got {:?}", other),
        }
    }

    #[test]
    fn refuses_a_zero_sized_frame() {
        let (_, cancel) = watch::channel(false);

        assert!(matches!(
            run_frames("/bin/echo", &[], 0, &cancel, |_, _| {}),
            Err(RunError::Io(_))
        ));
    }

    #[test]
    fn b11_2_returns_cancelled_without_running_when_already_cancelled() {
        let (tx, cancel) = watch::channel(false);
        tx.send(true).unwrap();

        assert!(matches!(
            run_frames("/bin/cat", &[], 16, &cancel, |_, _| {}),
            Err(RunError::Cancelled)
        ));
    }

    #[test]
    fn reads_a_frame_split_across_several_pipe_reads() {
        // A pipe may hand over fewer bytes than asked for. One `read` per frame
        // would mis-frame the whole stream from that point on.
        struct Dribble {
            data: Vec<u8>,
            position: usize,
        }
        impl Read for Dribble {
            fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
                if self.position >= self.data.len() {
                    return Ok(0);
                }
                buffer[0] = self.data[self.position];
                self.position += 1;
                Ok(1)
            }
        }

        let mut source = Dribble {
            data: vec![1, 2, 3, 4, 5, 6],
            position: 0,
        };
        let mut buffer = [0u8; 4];

        assert_eq!(read_exact_or_eof(&mut source, &mut buffer), Ok(4));
        assert_eq!(buffer, [1, 2, 3, 4]);
        assert_eq!(
            read_exact_or_eof(&mut source, &mut buffer),
            Ok(2),
            "a trailing partial frame is reported as short, not padded"
        );
    }
}
