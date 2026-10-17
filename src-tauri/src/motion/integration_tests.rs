//! Integration tests for the Motion render pipeline using real ffmpeg.
//!
//! Each test skips cleanly when ffmpeg is not installed, following the same
//! pattern as `kavanagh/integration_tests.rs`.

use std::path::Path;
use std::process::Command;

use crate::kavanagh::discovery::{probe_binary_path, resolve_ffmpeg_tools, FfmpegAvailability};

use super::encoder::{build_args, ActiveRender, RealSpawner, Spawner};

/// The toolchain, or `None` when this machine has no ffmpeg.
fn tools() -> Option<(String, String)> {
    match resolve_ffmpeg_tools(None, probe_binary_path) {
        FfmpegAvailability::Ready { ffmpeg, ffprobe } => Some((ffmpeg, ffprobe)),
        _ => None,
    }
}

/// Skips the test body when ffmpeg is not installed.
macro_rules! require_ffmpeg {
    () => {
        match tools() {
            Some(tools) => tools,
            None => {
                eprintln!("skipping: ffmpeg is not installed on this machine");
                return;
            }
        }
    };
}

/// Create a minimal RGBA PNG image with the given dimensions.
/// One pixel is fully transparent, the rest are opaque red.
fn create_test_png(width: u32, height: u32) -> Vec<u8> {
    // Build an uncompressed RGBA image with filter bytes
    let mut raw_data = Vec::new();
    for y in 0..height {
        raw_data.push(0); // filter byte: None
        for x in 0..width {
            if x == 0 && y == 0 {
                // Fully transparent pixel
                raw_data.extend_from_slice(&[0, 0, 0, 0]);
            } else {
                // Opaque red
                raw_data.extend_from_slice(&[255, 0, 0, 255]);
            }
        }
    }

    // Wrap in a zlib stream using uncompressed DEFLATE blocks (no compression
    // library needed). A zlib stream is: 2-byte header, DEFLATE blocks, Adler-32.
    let compressed = zlib_store(&raw_data);

    // Build the PNG file
    let mut png = Vec::new();
    // PNG signature
    png.extend_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    let mut ihdr_data = Vec::new();
    ihdr_data.extend_from_slice(&width.to_be_bytes());
    ihdr_data.extend_from_slice(&height.to_be_bytes());
    ihdr_data.push(8); // bit depth
    ihdr_data.push(6); // colour type: RGBA
    ihdr_data.push(0); // compression
    ihdr_data.push(0); // filter
    ihdr_data.push(0); // interlace
    write_png_chunk(&mut png, b"IHDR", &ihdr_data);

    // IDAT chunk
    write_png_chunk(&mut png, b"IDAT", &compressed);

    // IEND chunk
    write_png_chunk(&mut png, b"IEND", &[]);

    png
}

/// Build a zlib stream with uncompressed (stored) DEFLATE blocks.
/// Avoids any compression library dependency.
fn zlib_store(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    // Zlib header: CMF=0x78 (deflate, window 32k), FLG=0x01 (check bits)
    out.push(0x78);
    out.push(0x01);

    // Split data into stored blocks of up to 65535 bytes
    let chunks: Vec<&[u8]> = if data.is_empty() {
        vec![&[]]
    } else {
        data.chunks(65535).collect()
    };
    for (i, chunk) in chunks.iter().enumerate() {
        let is_last = i == chunks.len() - 1;
        out.push(if is_last { 0x01 } else { 0x00 }); // BFINAL + BTYPE=00 (stored)
        let len = chunk.len() as u16;
        let nlen = !len;
        out.extend_from_slice(&len.to_le_bytes());
        out.extend_from_slice(&nlen.to_le_bytes());
        out.extend_from_slice(chunk);
    }

    // Adler-32 checksum
    let adler = adler32(data);
    out.extend_from_slice(&adler.to_be_bytes());

    out
}

fn adler32(data: &[u8]) -> u32 {
    let mut a: u32 = 1;
    let mut b: u32 = 0;
    for &byte in data {
        a = (a + byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}

fn write_png_chunk(out: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    let len = data.len() as u32;
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(chunk_type);
    out.extend_from_slice(data);
    // CRC over type + data
    let mut crc_data = Vec::new();
    crc_data.extend_from_slice(chunk_type);
    crc_data.extend_from_slice(data);
    let crc = crc32(&crc_data);
    out.extend_from_slice(&crc.to_be_bytes());
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFFFFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

// ---------------------------------------------------------------
// R5.1 - real ffmpeg produces valid ProRes 4444
// ---------------------------------------------------------------
#[test]
fn r5_1_real_ffmpeg_prores_4444() {
    let (_ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();
    let out = dir.path().join("test_output.mov");

    let spawner = RealSpawner;
    let args = build_args(None, 64, 36, 25, &out).unwrap();
    let child = spawner.spawn(&args.ffmpeg_path, &args.args).unwrap();

    let mut render = ActiveRender {
        process: child,
        output_path: out.clone(),
        total_frames: 3,
        frames_written: 0,
    };

    let frame = create_test_png(64, 36);
    render.write_frame(&frame).unwrap();
    render.write_frame(&frame).unwrap();
    render.write_frame(&frame).unwrap();

    let result_path = render.finish().unwrap();
    assert!(Path::new(&result_path).exists());

    // Probe the output with ffprobe
    let probe_output = Command::new(&ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_streams",
            "-count_frames",
            out.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    let stdout = String::from_utf8_lossy(&probe_output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|_| panic!("ffprobe output is not valid JSON: {}", stdout));

    let stream = &json["streams"][0];
    assert_eq!(stream["codec_name"].as_str().unwrap(), "prores");
    assert_eq!(stream["profile"].as_str().unwrap(), "4444");
    let pix_fmt = stream["pix_fmt"].as_str().unwrap();
    assert!(
        pix_fmt.starts_with("yuva444p"),
        "expected pix_fmt starting with yuva444p, got: {}",
        pix_fmt
    );
    assert_eq!(stream["width"].as_u64().unwrap(), 64);
    assert_eq!(stream["height"].as_u64().unwrap(), 36);

    // Check frame count
    let nb_frames = stream["nb_read_frames"]
        .as_str()
        .unwrap_or("0")
        .parse::<u64>()
        .unwrap_or(0);
    assert_eq!(nb_frames, 3, "expected 3 frames, got {}", nb_frames);
}

// ---------------------------------------------------------------
// S9 - stderr drain: many frames with verbose logging must not
// hang even when stderr output exceeds the pipe buffer (64 KiB).
// On the current code, stderr is never drained so ffmpeg blocks
// once the buffer fills, which blocks stdin writes, hanging the
// render. With the fix, a drain thread keeps reading stderr.
// ---------------------------------------------------------------
#[test]
fn s9_many_frames_with_verbose_stderr_does_not_hang() {
    let (_ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();
    let out = dir.path().join("stderr_drain_test.mov");

    let spawner = RealSpawner;
    let mut args_obj = build_args(None, 64, 36, 25, &out).unwrap();

    // Override loglevel to verbose so ffmpeg produces lots of stderr.
    // Remove any existing -loglevel or -nostats so we control them.
    args_obj
        .args
        .retain(|a| a != "-nostats" && a != "-loglevel" && a != "error");
    // Insert -loglevel verbose before the output path (last arg)
    let out_idx = args_obj.args.len() - 1;
    args_obj.args.insert(out_idx, "-loglevel".to_string());
    args_obj.args.insert(out_idx + 1, "verbose".to_string());

    let child = spawner
        .spawn(&args_obj.ffmpeg_path, &args_obj.args)
        .unwrap();

    let mut render = ActiveRender {
        process: child,
        output_path: out.clone(),
        // 200 frames at verbose: each frame produces ~200 bytes of
        // stderr, totalling ~40 KiB plus the banner; on some ffmpeg
        // builds the per-frame output is larger, pushing past 64 KiB.
        total_frames: 200,
        frames_written: 0,
    };

    let frame = create_test_png(64, 36);
    for _ in 0..200 {
        render.write_frame(&frame).unwrap();
    }

    let result_path = render.finish().unwrap();
    assert!(Path::new(&result_path).exists());

    // Probe the output - should have 200 frames
    let probe_output = Command::new(&ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_streams",
            "-count_frames",
            out.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    let stdout = String::from_utf8_lossy(&probe_output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|_| panic!("ffprobe output is not valid JSON: {}", stdout));

    let stream = &json["streams"][0];
    let nb_frames = stream["nb_read_frames"]
        .as_str()
        .unwrap_or("0")
        .parse::<u64>()
        .unwrap_or(0);
    assert_eq!(nb_frames, 200, "expected 200 frames, got {}", nb_frames);
}

// ---------------------------------------------------------------
// R5.2 - cancel leaves no file and no orphan process
// ---------------------------------------------------------------
#[test]
fn r5_2_cancel_leaves_no_file() {
    let (_ffmpeg, _ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();
    let out = dir.path().join("cancel_output.mov");

    let spawner = RealSpawner;
    let args = build_args(None, 64, 36, 25, &out).unwrap();
    let child = spawner.spawn(&args.ffmpeg_path, &args.args).unwrap();

    let mut render = ActiveRender {
        process: child,
        output_path: out.clone(),
        total_frames: 10,
        frames_written: 0,
    };

    let frame = create_test_png(64, 36);
    render.write_frame(&frame).unwrap();

    render.cancel().unwrap();

    // No output file should remain
    assert!(
        !out.exists(),
        "partial output file should have been removed"
    );

    // Check no ffmpeg child is left running (best effort)
    // We cannot easily check by PID here, but the kill + wait in cancel
    // should have reaped the process.
}
