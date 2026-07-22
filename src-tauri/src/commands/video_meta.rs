use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use tauri::command;

/// Reads the duration (in seconds) of a local MP4/MOV file by parsing the
/// `moov/mvhd` box directly, avoiding any external media dependencies.
/// Used as a fallback when Sprout Video has not finished processing an
/// upload and cannot report a duration yet.
#[command]
pub fn get_video_duration(file_path: String) -> Result<f64, String> {
    let mut file = File::open(&file_path).map_err(|e| e.to_string())?;
    let file_size = file.metadata().map_err(|e| e.to_string())?.len();
    read_mvhd_duration(&mut file, file_size)
}

struct BoxHeader {
    box_type: [u8; 4],
    payload_start: u64,
    payload_end: u64,
}

/// Reads one ISO BMFF box header at `offset`, returning None when fewer than
/// 8 bytes remain before `end`.
fn read_box_header<R: Read + Seek>(
    reader: &mut R,
    offset: u64,
    end: u64,
) -> Result<Option<BoxHeader>, String> {
    if offset + 8 > end {
        return Ok(None);
    }
    reader
        .seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    let mut header = [0u8; 8];
    reader.read_exact(&mut header).map_err(|e| e.to_string())?;

    let size32 = u32::from_be_bytes([header[0], header[1], header[2], header[3]]) as u64;
    let mut box_type = [0u8; 4];
    box_type.copy_from_slice(&header[4..8]);

    // size == 1 means a 64-bit "largesize" follows; size == 0 means the box
    // extends to the end of the enclosing container.
    let (size, header_len) = match size32 {
        1 => {
            let mut large = [0u8; 8];
            reader.read_exact(&mut large).map_err(|e| e.to_string())?;
            (u64::from_be_bytes(large), 16u64)
        }
        0 => (end - offset, 8u64),
        n => (n, 8u64),
    };

    if size < header_len || offset + size > end {
        return Err("Malformed box header".to_string());
    }

    Ok(Some(BoxHeader {
        box_type,
        payload_start: offset + header_len,
        payload_end: offset + size,
    }))
}

fn find_box<R: Read + Seek>(
    reader: &mut R,
    mut offset: u64,
    end: u64,
    name: &[u8; 4],
) -> Result<BoxHeader, String> {
    while let Some(header) = read_box_header(reader, offset, end)? {
        offset = header.payload_end;
        if &header.box_type == name {
            return Ok(header);
        }
    }
    Err(format!(
        "'{}' box not found",
        String::from_utf8_lossy(name)
    ))
}

fn read_mvhd_duration<R: Read + Seek>(reader: &mut R, file_size: u64) -> Result<f64, String> {
    let moov = find_box(reader, 0, file_size, b"moov")?;
    let mvhd = find_box(reader, moov.payload_start, moov.payload_end, b"mvhd")?;

    let payload_len = (mvhd.payload_end - mvhd.payload_start) as usize;
    let mut payload = vec![0u8; payload_len];
    reader
        .seek(SeekFrom::Start(mvhd.payload_start))
        .map_err(|e| e.to_string())?;
    reader.read_exact(&mut payload).map_err(|e| e.to_string())?;

    // mvhd layout after version(1)+flags(3):
    //   v0: creation u32, modification u32, timescale u32, duration u32
    //   v1: creation u64, modification u64, timescale u32, duration u64
    let version = *payload.first().ok_or("Empty mvhd box")?;
    let (timescale, duration) = match version {
        1 => {
            if payload.len() < 32 {
                return Err("mvhd box too short".to_string());
            }
            (
                u32::from_be_bytes(payload[20..24].try_into().unwrap()),
                u64::from_be_bytes(payload[24..32].try_into().unwrap()),
            )
        }
        _ => {
            if payload.len() < 20 {
                return Err("mvhd box too short".to_string());
            }
            (
                u32::from_be_bytes(payload[12..16].try_into().unwrap()),
                u32::from_be_bytes(payload[16..20].try_into().unwrap()) as u64,
            )
        }
    };

    if timescale == 0 || duration == 0 {
        return Err("Video duration not available in file metadata".to_string());
    }

    Ok(duration as f64 / timescale as f64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn boxed(name: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(&((payload.len() as u32) + 8).to_be_bytes());
        out.extend_from_slice(name);
        out.extend_from_slice(payload);
        out
    }

    fn mvhd_v0(timescale: u32, duration: u32) -> Vec<u8> {
        let mut payload = vec![0u8; 20];
        payload[12..16].copy_from_slice(&timescale.to_be_bytes());
        payload[16..20].copy_from_slice(&duration.to_be_bytes());
        boxed(b"mvhd", &payload)
    }

    fn mvhd_v1(timescale: u32, duration: u64) -> Vec<u8> {
        let mut payload = vec![0u8; 32];
        payload[0] = 1;
        payload[20..24].copy_from_slice(&timescale.to_be_bytes());
        payload[24..32].copy_from_slice(&duration.to_be_bytes());
        boxed(b"mvhd", &payload)
    }

    #[test]
    fn reads_version_0_duration() {
        // ftyp precedes moov, as in real files
        let mut data = boxed(b"ftyp", &[0u8; 8]);
        data.extend(boxed(b"moov", &mvhd_v0(600, 54_000))); // 90 seconds
        let len = data.len() as u64;
        let result = read_mvhd_duration(&mut Cursor::new(data), len).unwrap();
        assert!((result - 90.0).abs() < f64::EPSILON);
    }

    #[test]
    fn reads_version_1_duration() {
        let mut data = boxed(b"mdat", &[0u8; 16]);
        data.extend(boxed(b"moov", &mvhd_v1(1000, 3_725_000))); // 3725 seconds
        let len = data.len() as u64;
        let result = read_mvhd_duration(&mut Cursor::new(data), len).unwrap();
        assert!((result - 3725.0).abs() < f64::EPSILON);
    }

    #[test]
    fn errors_when_moov_missing() {
        let data = boxed(b"mdat", &[0u8; 16]);
        let len = data.len() as u64;
        assert!(read_mvhd_duration(&mut Cursor::new(data), len).is_err());
    }

    #[test]
    fn errors_on_zero_duration() {
        let mut data = Vec::new();
        data.extend(boxed(b"moov", &mvhd_v0(600, 0)));
        let len = data.len() as u64;
        assert!(read_mvhd_duration(&mut Cursor::new(data), len).is_err());
    }
}
