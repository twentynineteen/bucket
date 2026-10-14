//! Reference pool preparation: measuring each reference's alpha bbox, scaling
//! it onto the video, building templates and noting pool quirks.

use tokio::sync::watch;

use super::super::error::KavanaghError;
use super::super::ffmpeg::run_capture;
use super::super::geometry::{
    corner_of, is_wide_mark, place_region, scale_bbox, scoring_subwindow, union, Corner, CropRegion,
};
use super::super::matching::{dedupe_by_alpha, sobel_magnitude, WatermarkTemplate};
use super::super::parsing::{parse_alpha_bbox, parse_showinfo_size, VideoProbe};
use super::{file_name_of, run_error, AnalysisRequest};

/// A reference pool prepared for one video: templates plus the regions to crop.
#[derive(Debug, Clone)]
pub struct PreparedReferences {
    pub templates: Vec<WatermarkTemplate>,
    /// The region to crop per corner, all of exactly the same size. Transport
    /// only: scoring happens over each template's own subwindow within its
    /// corner's crop (issue #266).
    pub regions: Vec<(Corner, CropRegion)>,
    pub region_width: u32,
    pub region_height: u32,
    /// References whose mark spans most of its own frame, named in the report
    /// so a banner-class asset in the pool is loud rather than silently odd.
    pub wide_references: Vec<String>,
    /// References skipped because their subwindow fell outside what this video's
    /// dimensions allow, named in the report rather than scoring a silent zero.
    pub skipped_references: Vec<String>,
}

/// Measures every reference's alpha bbox and builds a template per reference.
///
/// A reference that cannot be read is skipped rather than failing the run: a pool
/// of eight assets should not be unusable because someone dropped a corrupt PNG in
/// it. If *nothing* in the pool is usable, that is reported.
pub(super) fn prepare_references(
    request: &AnalysisRequest,
    probe: &VideoProbe,
    cancel: &watch::Receiver<bool>,
) -> Result<PreparedReferences, KavanaghError> {
    struct Measured {
        path: String,
        corner: Corner,
        region: CropRegion,
    }

    let mut measured: Vec<Measured> = Vec::new();
    let mut wide_references: Vec<String> = Vec::new();

    for path in &request.reference_files {
        let args = vec![
            "-v".to_string(),
            // `bbox` and `showinfo` both log at info level, so `-v error` would
            // suppress the very output being parsed and the run would succeed
            // with nothing to read.
            "info".to_string(),
            "-i".to_string(),
            path.clone(),
            "-vf".to_string(),
            "alphaextract,bbox=min_val=16,showinfo".to_string(),
            "-f".to_string(),
            "null".to_string(),
            "-".to_string(),
        ];

        let Ok((_, run)) = run_capture(&request.ffmpeg, &args, cancel) else {
            continue;
        };

        let Some(bbox) = parse_alpha_bbox(&run.stderr_tail) else {
            continue;
        };
        let Some((reference_width, reference_height)) = parse_showinfo_size(&run.stderr_tail)
        else {
            continue;
        };

        if is_wide_mark(&bbox, reference_width, reference_height) {
            wide_references.push(file_name_of(path));
        }

        measured.push(Measured {
            path: path.clone(),
            corner: corner_of(&bbox, reference_width),
            region: scale_bbox(
                &bbox,
                reference_width,
                reference_height,
                probe.width,
                probe.height,
            ),
        });
    }

    if measured.is_empty() {
        return Err(KavanaghError::ReferencePool {
            message:
                "None of the watermark reference images could be read as an image with an alpha channel."
                    .to_string(),
        });
    }

    // One region per corner, covering every reference that sits in it: the assets
    // are hand-made and their boxes land within a few pixels of one another.
    let mut regions: Vec<(Corner, CropRegion)> = Vec::new();
    for corner in [Corner::TopLeft, Corner::TopRight] {
        let merged = measured
            .iter()
            .filter(|m| m.corner == corner)
            .map(|m| m.region)
            .reduce(|a, b| union(&a, &b));
        if let Some(region) = merged {
            regions.push((corner, region));
        }
    }

    // A single size across corners, since hstack refuses mismatched inputs.
    let region_width = regions.iter().map(|(_, r)| r.width).max().unwrap_or(1);
    let region_height = regions.iter().map(|(_, r)| r.height).max().unwrap_or(1);
    let regions: Vec<(Corner, CropRegion)> = regions
        .iter()
        .map(|(corner, region)| {
            (
                *corner,
                place_region(
                    region,
                    region_width,
                    region_height,
                    probe.width,
                    probe.height,
                ),
            )
        })
        .collect();

    let mut templates = Vec::new();
    let mut skipped_references = Vec::new();
    for reference in &measured {
        let Some((_, crop)) = regions
            .iter()
            .find(|(corner, _)| *corner == reference.corner)
        else {
            continue;
        };

        // Each reference is scored over its own mark's extent, not the corner's
        // union: a full-frame banner in the pool used to inflate the union until
        // every other template was mostly empty and correlation measured backdrop
        // flatness instead of mark presence (issue #266). The intersection is
        // computed here, not at score time, so the template and the window read
        // out of the decoded crop always agree in shape.
        let Some(subwindow) = scoring_subwindow(&reference.region, crop) else {
            skipped_references.push(file_name_of(&reference.path));
            continue;
        };

        let window_in_crop = CropRegion {
            x: subwindow.x - crop.x,
            y: subwindow.y - crop.y,
            width: subwindow.width,
            height: subwindow.height,
        };

        if let Some(template) = build_template(
            request,
            reference.path.clone(),
            subwindow,
            window_in_crop,
            reference.corner,
            probe,
            cancel,
        )? {
            templates.push(template);
        }
    }

    // Colour variants carry identical alpha maps, so matching against both costs
    // twice the correlation for no extra coverage.
    let templates = dedupe_by_alpha(templates);

    if templates.is_empty() {
        return Err(KavanaghError::ReferencePool {
            message: "The watermark reference images could not be decoded for comparison."
                .to_string(),
        });
    }

    Ok(PreparedReferences {
        templates,
        regions,
        region_width,
        region_height,
        wide_references,
        skipped_references,
    })
}

/// Notes a run must carry about the reference pool itself (issue #266).
///
/// Wide first, then skipped, so a report reads from "this asset is unusual" to
/// "this asset was not checked". Worded without a matchability claim: a wide
/// reference may also have been deduped or failed to decode, and the note must
/// stay true either way.
pub fn pool_notes(wide: &[String], skipped: &[String]) -> Vec<String> {
    let mut notes: Vec<String> = wide
        .iter()
        .map(|name| {
            format!(
                "{} has a mark that spans most of its frame, so it was inspected over its own region; corner labels are nominal for this asset.",
                name
            )
        })
        .collect();

    notes.extend(skipped.iter().map(|name| {
        format!(
            "{} was not checked: its mark falls outside the region this video's dimensions allow.",
            name
        )
    }));

    notes
}

/// Decodes one reference's **alpha map** over the inspection region and turns it
/// into a template.
///
/// The alpha map, not the reference composited over anything. The brand assets are a
/// pure monochrome shape plus a varying alpha mask: the Black variant is luma 0
/// everywhere and the White variant luma 255 everywhere, and both carry the *same*
/// alpha map, peaking at 137 of 255 - so the mark is never more than 54% opaque and
/// the backdrop always shows through it.
///
/// That makes the composited appearance backdrop-dependent and useless as a
/// template: black at 54% over dark footage reads strongly, white at 54% over a
/// bright office barely shifts the luma at all. The alpha map is the invariant, and
/// normalised correlation then absorbs the backdrop-dependent difference in signal
/// strength as a scale factor.
///
/// `format=rgba` is forced before `alphaextract` because format negotiation
/// propagates upstream: without it the chain settles on a format with no alpha plane
/// and `alphaextract` fails with "Requested planes not available".
fn build_template(
    request: &AnalysisRequest,
    path: String,
    region: CropRegion,
    window: CropRegion,
    corner: Corner,
    probe: &VideoProbe,
    cancel: &watch::Receiver<bool>,
) -> Result<Option<WatermarkTemplate>, KavanaghError> {
    let graph = format!(
        "[0:v]scale={}:{},crop={}:{}:{}:{},format=rgba,alphaextract,format=gray[out]",
        probe.width, probe.height, region.width, region.height, region.x, region.y
    );

    let args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-i".to_string(),
        path.clone(),
        "-filter_complex".to_string(),
        graph,
        "-map".to_string(),
        "[out]".to_string(),
        "-frames:v".to_string(),
        "1".to_string(),
        "-f".to_string(),
        "rawvideo".to_string(),
        "-".to_string(),
    ];

    let (stdout, run) = run_capture(&request.ffmpeg, &args, cancel).map_err(run_error)?;

    let width = region.width as usize;
    let height = region.height as usize;
    if !run.exit_ok || stdout.len() < width * height {
        return Ok(None);
    }

    Ok(Some(WatermarkTemplate {
        name: file_name_of(&path),
        corner,
        window,
        alpha: stdout[..width * height].to_vec(),
        gradient: sobel_magnitude(&stdout[..width * height], width, height),
        // Uniform: the alpha map already *is* the mark's shape, so there is nothing
        // left for a separate mask to exclude, and the bbox is the mark's own extent
        // rather than a region with footage around it. `weighted_ncc` stays the
        // primitive so a future mask - glyph strokes only, say - is a one-line change.
        weights: vec![1.0; width * height],
    }))
}
