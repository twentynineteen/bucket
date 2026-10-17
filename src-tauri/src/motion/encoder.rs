//! ffmpeg argument building, process lifecycle and partial-file cleanup.
//!
//! The pipeline is behind a `Spawner` trait so unit tests can use a fake
//! process that records what was written to stdin without running real ffmpeg.

use std::path::{Path, PathBuf};

use crate::kavanagh::discovery::{probe_binary_path, resolve_ffmpeg_tools, FfmpegAvailability};

use super::commands::MotionError;

/// The ffmpeg arguments built for one render.
#[derive(Debug, Clone)]
pub struct FfmpegArgs {
    pub ffmpeg_path: String,
    pub args: Vec<String>,
    pub output_path: PathBuf,
}

/// Build the ffmpeg command-line arguments for a ProRes 4444 render.
///
/// Returns `Err` when ffmpeg cannot be resolved or the output path exists.
pub fn build_args(
    ffmpeg_directory: Option<&str>,
    width: u32,
    height: u32,
    fps: u32,
    output_path: &Path,
) -> Result<FfmpegArgs, MotionError> {
    let ffmpeg_path = match resolve_ffmpeg_tools(ffmpeg_directory, probe_binary_path) {
        FfmpegAvailability::Ready { ffmpeg, .. } => ffmpeg,
        FfmpegAvailability::NotFound { missing, searched } => {
            return Err(MotionError {
                kind: "ffmpegMissing".to_string(),
                message: format!(
                    "ffmpeg not found (missing: {}; searched: {})",
                    missing.join(", "),
                    searched.join(", ")
                ),
            });
        }
        FfmpegAvailability::NotExecutable { path } => {
            return Err(MotionError {
                kind: "ffmpegMissing".to_string(),
                message: format!("ffmpeg not executable: {}", path),
            });
        }
    };

    if output_path.exists() {
        return Err(MotionError {
            kind: "spawnFailed".to_string(),
            message: format!("output file already exists: {}", output_path.display()),
        });
    }

    let size = format!("{}x{}", width, height);
    let args = vec![
        "-f".to_string(),
        "image2pipe".to_string(),
        "-framerate".to_string(),
        fps.to_string(),
        "-i".to_string(),
        "-".to_string(),
        "-c:v".to_string(),
        "prores_ks".to_string(),
        "-profile:v".to_string(),
        "4444".to_string(),
        "-pix_fmt".to_string(),
        "yuva444p10le".to_string(),
        "-s".to_string(),
        size,
        "-n".to_string(),
        output_path.to_string_lossy().to_string(),
    ];

    Ok(FfmpegArgs {
        ffmpeg_path,
        args,
        output_path: output_path.to_path_buf(),
    })
}

/// Trait abstracting process spawning so unit tests can inject a fake.
pub trait Spawner: Send + Sync + 'static {
    type Process: ChildProcess;
    fn spawn(&self, program: &str, args: &[String]) -> Result<Self::Process, std::io::Error>;
}

/// Trait abstracting a child process.
pub trait ChildProcess: Send + 'static {
    /// Write bytes to the child's stdin.
    fn write_stdin(&mut self, data: &[u8]) -> Result<(), std::io::Error>;
    /// Close stdin and wait for the process to exit. Returns (exit code, stderr tail).
    fn finish(self) -> Result<(i32, String), std::io::Error>;
    /// Kill the process immediately.
    fn kill(&mut self) -> Result<(), std::io::Error>;
    /// Check if the process has exited (non-blocking).
    fn try_wait(&mut self) -> Result<Option<i32>, std::io::Error>;
}

/// Real spawner that runs a system process.
pub struct RealSpawner;

impl Spawner for RealSpawner {
    type Process = RealChild;
    fn spawn(&self, program: &str, args: &[String]) -> Result<Self::Process, std::io::Error> {
        use std::process::{Command, Stdio};
        let child = Command::new(program)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()?;
        Ok(RealChild { child })
    }
}

/// Wraps a real `std::process::Child`.
pub struct RealChild {
    child: std::process::Child,
}

impl ChildProcess for RealChild {
    fn write_stdin(&mut self, data: &[u8]) -> Result<(), std::io::Error> {
        use std::io::Write;
        if let Some(ref mut stdin) = self.child.stdin {
            stdin.write_all(data)?;
            stdin.flush()?;
            Ok(())
        } else {
            Err(std::io::Error::new(
                std::io::ErrorKind::BrokenPipe,
                "stdin closed",
            ))
        }
    }

    fn finish(mut self) -> Result<(i32, String), std::io::Error> {
        // Drop stdin to signal EOF to ffmpeg
        drop(self.child.stdin.take());

        let output = self.child.wait_with_output()?;
        let stderr = String::from_utf8_lossy(&output.stderr)
            .lines()
            .rev()
            .take(20)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        let code = output.status.code().unwrap_or(-1);
        Ok((code, stderr))
    }

    fn kill(&mut self) -> Result<(), std::io::Error> {
        // Drop stdin first to avoid broken pipe on the ffmpeg side
        drop(self.child.stdin.take());
        self.child.kill()?;
        let _ = self.child.wait();
        Ok(())
    }

    fn try_wait(&mut self) -> Result<Option<i32>, std::io::Error> {
        match self.child.try_wait()? {
            Some(status) => Ok(Some(status.code().unwrap_or(-1))),
            None => Ok(None),
        }
    }
}

/// An active render session, holding the ffmpeg child and metadata.
pub struct ActiveRender<P: ChildProcess> {
    pub process: P,
    pub output_path: PathBuf,
    pub total_frames: u32,
    pub frames_written: u32,
}

impl<P: ChildProcess> ActiveRender<P> {
    /// Write one PNG frame to ffmpeg's stdin.
    pub fn write_frame(&mut self, png_data: &[u8]) -> Result<(), MotionError> {
        // Check if the process has died before writing
        match self.process.try_wait() {
            Ok(Some(code)) => {
                let _ = std::fs::remove_file(&self.output_path);
                return Err(MotionError {
                    kind: "encodeFailed".to_string(),
                    message: format!("ffmpeg exited with code {} while writing frames", code),
                });
            }
            Ok(None) => {} // Still running - good
            Err(e) => {
                let _ = std::fs::remove_file(&self.output_path);
                return Err(MotionError {
                    kind: "encodeFailed".to_string(),
                    message: format!("failed to check ffmpeg status: {}", e),
                });
            }
        }

        self.process.write_stdin(png_data).map_err(|e| {
            let _ = std::fs::remove_file(&self.output_path);
            MotionError {
                kind: "encodeFailed".to_string(),
                message: format!("failed to write frame to ffmpeg: {}", e),
            }
        })?;
        self.frames_written += 1;
        Ok(())
    }

    /// Close stdin, wait for ffmpeg to finish, return the output path.
    pub fn finish(self) -> Result<String, MotionError> {
        let output_path = self.output_path.clone();
        match self.process.finish() {
            Ok((0, _)) => Ok(output_path.to_string_lossy().to_string()),
            Ok((code, stderr)) => {
                let _ = std::fs::remove_file(&output_path);
                Err(MotionError {
                    kind: "encodeFailed".to_string(),
                    message: format!("ffmpeg exited with code {}:\n{}", code, stderr),
                })
            }
            Err(e) => {
                let _ = std::fs::remove_file(&output_path);
                Err(MotionError {
                    kind: "encodeFailed".to_string(),
                    message: format!("failed waiting for ffmpeg: {}", e),
                })
            }
        }
    }

    /// Kill ffmpeg and remove the partial file.
    pub fn cancel(mut self) -> Result<(), MotionError> {
        let _ = self.process.kill();
        let _ = std::fs::remove_file(&self.output_path);
        Ok(())
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    /// A fake child process that records stdin writes.
    pub struct FakeChild {
        pub written: Arc<Mutex<Vec<Vec<u8>>>>,
        pub stdin_closed: Arc<Mutex<bool>>,
        pub exit_code: Arc<Mutex<i32>>,
        pub stderr: Arc<Mutex<String>>,
        pub killed: Arc<Mutex<bool>>,
        /// When set, try_wait returns Some(code) simulating a dead process.
        pub dead: Arc<Mutex<Option<i32>>>,
    }

    impl FakeChild {
        pub fn new() -> Self {
            Self {
                written: Arc::new(Mutex::new(Vec::new())),
                stdin_closed: Arc::new(Mutex::new(false)),
                exit_code: Arc::new(Mutex::new(0)),
                stderr: Arc::new(Mutex::new(String::new())),
                killed: Arc::new(Mutex::new(false)),
                dead: Arc::new(Mutex::new(None)),
            }
        }

        /// Create a handle that can be used to inspect or control the fake
        /// from outside the render pipeline.
        pub fn handle(&self) -> FakeChildHandle {
            FakeChildHandle {
                written: Arc::clone(&self.written),
                stdin_closed: Arc::clone(&self.stdin_closed),
                killed: Arc::clone(&self.killed),
                dead: Arc::clone(&self.dead),
            }
        }
    }

    /// A cloneable handle to inspect a FakeChild's state from test code.
    #[derive(Clone)]
    pub struct FakeChildHandle {
        pub written: Arc<Mutex<Vec<Vec<u8>>>>,
        pub stdin_closed: Arc<Mutex<bool>>,
        pub killed: Arc<Mutex<bool>>,
        pub dead: Arc<Mutex<Option<i32>>>,
    }

    impl ChildProcess for FakeChild {
        fn write_stdin(&mut self, data: &[u8]) -> Result<(), std::io::Error> {
            if *self.killed.lock().unwrap() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::BrokenPipe,
                    "process killed",
                ));
            }
            self.written.lock().unwrap().push(data.to_vec());
            Ok(())
        }

        fn finish(self) -> Result<(i32, String), std::io::Error> {
            *self.stdin_closed.lock().unwrap() = true;
            let code = *self.exit_code.lock().unwrap();
            let stderr = self.stderr.lock().unwrap().clone();
            Ok((code, stderr))
        }

        fn kill(&mut self) -> Result<(), std::io::Error> {
            *self.killed.lock().unwrap() = true;
            Ok(())
        }

        fn try_wait(&mut self) -> Result<Option<i32>, std::io::Error> {
            Ok(*self.dead.lock().unwrap())
        }
    }

    // ---------------------------------------------------------------
    // S9 - ffmpeg args include -nostats -loglevel error
    // ---------------------------------------------------------------
    #[test]
    fn s9_ffmpeg_args_include_nostats_loglevel_error() {
        let avail = resolve_ffmpeg_tools(None, probe_binary_path);
        if !matches!(avail, FfmpegAvailability::Ready { .. }) {
            eprintln!("skipping s9: ffmpeg not installed");
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");
        let result = build_args(None, 1920, 1080, 25, &out).unwrap();
        let args = &result.args;
        assert!(
            args.contains(&"-nostats".to_string()),
            "expected -nostats in ffmpeg args, got: {:?}",
            args
        );
        assert!(
            args.contains(&"-loglevel".to_string()),
            "expected -loglevel in ffmpeg args, got: {:?}",
            args
        );
        let ll_idx = args.iter().position(|a| a == "-loglevel").unwrap();
        assert_eq!(
            args[ll_idx + 1],
            "error",
            "expected -loglevel error, got: {}",
            args[ll_idx + 1]
        );
    }

    // ---------------------------------------------------------------
    // R1.1 - ffmpeg arguments
    // ---------------------------------------------------------------
    #[test]
    fn r1_1_ffmpeg_args_correct() {
        let avail = resolve_ffmpeg_tools(None, probe_binary_path);
        let ffmpeg_path = match avail {
            FfmpegAvailability::Ready { ffmpeg, .. } => ffmpeg,
            _ => {
                eprintln!("skipping r1_1: ffmpeg not installed");
                return;
            }
        };

        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");
        let result = build_args(None, 1920, 1080, 25, &out).unwrap();

        let args = &result.args;
        assert!(args.contains(&"-f".to_string()));
        assert!(args.contains(&"image2pipe".to_string()));
        assert!(args.contains(&"-framerate".to_string()));
        assert!(args.contains(&"25".to_string()));
        assert!(args.contains(&"-i".to_string()));
        assert!(args.contains(&"-".to_string()));
        assert!(args.contains(&"-c:v".to_string()));
        assert!(args.contains(&"prores_ks".to_string()));
        assert!(args.contains(&"-profile:v".to_string()));
        assert!(args.contains(&"4444".to_string()));
        assert!(args.contains(&"-pix_fmt".to_string()));
        assert!(args.contains(&"yuva444p10le".to_string()));
        assert!(args.contains(&"1920x1080".to_string()));
        assert!(args.contains(&"-n".to_string()));
        assert!(!args.contains(&"-y".to_string()));
        assert_eq!(result.ffmpeg_path, ffmpeg_path);
        assert_eq!(result.output_path, out);
    }

    // ---------------------------------------------------------------
    // R1.2 - output path exists
    // ---------------------------------------------------------------
    #[test]
    fn r1_2_output_exists_fails() {
        let avail = resolve_ffmpeg_tools(None, probe_binary_path);
        if !matches!(avail, FfmpegAvailability::Ready { .. }) {
            eprintln!("skipping r1_2: ffmpeg not installed");
            return;
        }

        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("existing.mov");
        std::fs::write(&out, b"existing").unwrap();

        let result = build_args(None, 1920, 1080, 25, &out);
        let err = result.unwrap_err();
        assert_eq!(err.kind, "spawnFailed");
        assert!(std::fs::read(&out).unwrap() == b"existing");
    }

    // ---------------------------------------------------------------
    // R2.1 - custom ffmpeg directory
    // ---------------------------------------------------------------
    #[test]
    fn r2_1_custom_ffmpeg_directory() {
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");
        let result = build_args(Some("/nonexistent/custom/path"), 1920, 1080, 25, &out);
        let err = result.unwrap_err();
        assert_eq!(err.kind, "ffmpegMissing");
    }

    // ---------------------------------------------------------------
    // R2.2 - ffmpeg missing
    // ---------------------------------------------------------------
    #[test]
    fn r2_2_ffmpeg_missing() {
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");
        let result = build_args(Some("/definitely/not/a/real/path"), 1920, 1080, 25, &out);
        let err = result.unwrap_err();
        assert_eq!(err.kind, "ffmpegMissing");
    }

    // ---------------------------------------------------------------
    // R3.1 - three frames written, finish returns path
    // ---------------------------------------------------------------
    #[test]
    fn r3_1_three_frames_and_finish() {
        let fake = FakeChild::new();
        let handle = fake.handle();
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");

        let mut render = ActiveRender {
            process: fake,
            output_path: out.clone(),
            total_frames: 3,
            frames_written: 0,
        };

        let frame1 = vec![0x89, 0x50, 0x4E, 0x47];
        let frame2 = vec![0x89, 0x50, 0x4E, 0x48];
        let frame3 = vec![0x89, 0x50, 0x4E, 0x49];

        render.write_frame(&frame1).unwrap();
        render.write_frame(&frame2).unwrap();
        render.write_frame(&frame3).unwrap();

        assert_eq!(render.frames_written, 3);

        let written = handle.written.lock().unwrap();
        assert_eq!(written.len(), 3);
        assert_eq!(written[0], frame1);
        assert_eq!(written[1], frame2);
        assert_eq!(written[2], frame3);
        drop(written);

        let path = render.finish().unwrap();
        assert_eq!(path, out.to_string_lossy().to_string());
        assert!(*handle.stdin_closed.lock().unwrap());
    }

    // ---------------------------------------------------------------
    // R3.2 - progress tracking (frames_written increments)
    // ---------------------------------------------------------------
    #[test]
    fn r3_2_progress_increments() {
        let fake = FakeChild::new();
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");

        let mut render = ActiveRender {
            process: fake,
            output_path: out,
            total_frames: 3,
            frames_written: 0,
        };

        render.write_frame(&[0x89]).unwrap();
        assert_eq!(render.frames_written, 1);
        assert_eq!(render.total_frames, 3);

        render.write_frame(&[0x89]).unwrap();
        assert_eq!(render.frames_written, 2);

        render.write_frame(&[0x89]).unwrap();
        assert_eq!(render.frames_written, 3);
    }

    // ---------------------------------------------------------------
    // R3.3 - ffmpeg exits non-zero
    // ---------------------------------------------------------------
    #[test]
    fn r3_3_ffmpeg_non_zero_exit() {
        let fake = FakeChild::new();
        *fake.exit_code.lock().unwrap() = 1;
        *fake.stderr.lock().unwrap() = "Encoder error occurred".to_string();
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");
        std::fs::write(&out, b"partial").unwrap();

        let render = ActiveRender {
            process: fake,
            output_path: out.clone(),
            total_frames: 3,
            frames_written: 0,
        };

        let err = render.finish().unwrap_err();
        assert_eq!(err.kind, "encodeFailed");
        assert!(err.message.contains("Encoder error"));
        assert!(!out.exists());
    }

    // ---------------------------------------------------------------
    // R3.4 - ffmpeg dies mid-frame
    // ---------------------------------------------------------------
    #[test]
    fn r3_4_ffmpeg_dies_mid_frame() {
        let fake = FakeChild::new();
        let handle = fake.handle();
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");
        std::fs::write(&out, b"partial").unwrap();

        let mut render = ActiveRender {
            process: fake,
            output_path: out.clone(),
            total_frames: 10,
            frames_written: 0,
        };

        render.write_frame(&[0x89]).unwrap();

        // Simulate process death
        *handle.dead.lock().unwrap() = Some(139);

        let err = render.write_frame(&[0x89]).unwrap_err();
        assert_eq!(err.kind, "encodeFailed");
        assert!(!out.exists());
    }

    // ---------------------------------------------------------------
    // R4.1 - cancel kills and cleans up
    // ---------------------------------------------------------------
    #[test]
    fn r4_1_cancel_kills_and_cleans() {
        let fake = FakeChild::new();
        let handle = fake.handle();
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out.mov");
        std::fs::write(&out, b"partial").unwrap();

        let mut render = ActiveRender {
            process: fake,
            output_path: out.clone(),
            total_frames: 10,
            frames_written: 0,
        };

        render.write_frame(&[0x89]).unwrap();
        render.write_frame(&[0x89]).unwrap();
        assert_eq!(render.frames_written, 2);

        render.cancel().unwrap();
        assert!(*handle.killed.lock().unwrap());
        assert!(!out.exists());
    }
}
