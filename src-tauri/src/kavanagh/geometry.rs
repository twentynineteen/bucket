//! Watermark region geometry (issue #180, stage 2, B3).
//!
//! Reference watermarks are **full-frame RGBA canvases**, not corner crops: the
//! real assets are 1920x1080 and 3840x2160 with the mark sitting inside them.
//! The region to inspect is therefore derived from a reference's own alpha
//! bounding box, scaled to the video's dimensions, rather than searched for in a
//! guessed percentage-based corner.
//!
//! Two consequences fall out of that, both of which simplify the check:
//!
//! 1. The corner (top-left or top-right) is a property of the asset, read off
//!    its bbox, not something to hunt for in the frame.
//! 2. The reference and the frame pass through the same scale-then-crop, so they
//!    are comparable by construction even when the aspect ratios differ (a
//!    vertical render distorts both identically, B12.4).

use serde::Serialize;

/// The bounding box of a reference image's opaque pixels, in that image's own
/// pixel coordinates. Inclusive of both bounds, matching ffmpeg's `bbox` filter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AlphaBbox {
    pub x1: u32,
    pub y1: u32,
    pub x2: u32,
    pub y2: u32,
}

impl AlphaBbox {
    pub fn width(&self) -> u32 {
        self.x2.saturating_sub(self.x1) + 1
    }

    pub fn height(&self) -> u32 {
        self.y2.saturating_sub(self.y1) + 1
    }
}

/// Which top corner a watermark occupies.
///
/// Only the two top corners exist because that is where the brand places the
/// mark. A mid-video change between them is a failure (B3.7), not something to
/// tolerate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Corner {
    TopLeft,
    TopRight,
}

impl Corner {
    /// Wording for a report or an error message.
    pub fn label(&self) -> &'static str {
        match self {
            Corner::TopLeft => "top-left",
            Corner::TopRight => "top-right",
        }
    }
}

/// A rectangle to crop out of a video frame, in that video's pixel coordinates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CropRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Reads which corner a reference's mark sits in from its own alpha bbox.
///
/// Decided on the bbox centre against the canvas midpoint: a mark whose box
/// straddles the midpoint is not something the brand produces, and picking the
/// side its centre falls on is the only sane reading of one if it appears.
pub fn corner_of(bbox: &AlphaBbox, reference_width: u32) -> Corner {
    let centre = u64::from(bbox.x1) + u64::from(bbox.x2);
    if centre < u64::from(reference_width) {
        Corner::TopLeft
    } else {
        Corner::TopRight
    }
}

/// Scales a reference's alpha bbox into a crop region on a video of different
/// dimensions.
///
/// The axes scale independently. That distorts a square mark on a video whose
/// aspect ratio differs from the reference's, which sounds wrong until you note
/// that the reference itself is scaled to the video's dimensions before being
/// cropped - so both sides of the comparison are distorted identically and the
/// correlation is unaffected (B12.4).
///
/// The result is clamped inside the frame: a reference wider than the video
/// would otherwise produce a crop ffmpeg rejects at filter-graph build time,
/// which is a far worse error message than a slightly clipped region.
pub fn scale_bbox(
    bbox: &AlphaBbox,
    reference_width: u32,
    reference_height: u32,
    video_width: u32,
    video_height: u32,
) -> CropRegion {
    if reference_width == 0 || reference_height == 0 || video_width == 0 || video_height == 0 {
        return CropRegion {
            x: 0,
            y: 0,
            width: video_width.max(1),
            height: video_height.max(1),
        };
    }

    let sx = f64::from(video_width) / f64::from(reference_width);
    let sy = f64::from(video_height) / f64::from(reference_height);

    let x = (f64::from(bbox.x1) * sx).floor() as u32;
    let y = (f64::from(bbox.y1) * sy).floor() as u32;
    let width = (f64::from(bbox.width()) * sx).round().max(1.0) as u32;
    let height = (f64::from(bbox.height()) * sy).round().max(1.0) as u32;

    clamp_to_frame(
        CropRegion {
            x,
            y,
            width,
            height,
        },
        video_width,
        video_height,
    )
}

/// Keeps a region inside the frame, shrinking it rather than moving it: the mark
/// is at a fixed position, so sliding the window would sample the wrong pixels.
pub fn clamp_to_frame(region: CropRegion, video_width: u32, video_height: u32) -> CropRegion {
    let x = region.x.min(video_width.saturating_sub(1));
    let y = region.y.min(video_height.saturating_sub(1));
    CropRegion {
        x,
        y,
        width: region.width.min(video_width - x).max(1),
        height: region.height.min(video_height - y).max(1),
    }
}

/// The smallest region containing both.
///
/// Several references share a corner (Black and White variants of the same mark,
/// plus resolution variants) and their scaled boxes land within a few pixels of
/// one another rather than exactly on top: the real 4K asset measures 295x294 at
/// x3505 where a doubled 1080p box would be 296x296 at x3502. Inspecting the
/// union means no reference is ever matched against a region that clips it.
pub fn union(a: &CropRegion, b: &CropRegion) -> CropRegion {
    let x = a.x.min(b.x);
    let y = a.y.min(b.y);
    let right = (a.x + a.width).max(b.x + b.width);
    let bottom = (a.y + a.height).max(b.y + b.height);
    CropRegion {
        x,
        y,
        width: right - x,
        height: bottom - y,
    }
}

/// The overlap between a reference's own scoring region and the placed crop it
/// will be read out of, or `None` when the overlap cannot carry a score.
///
/// Computed at prepare time so the template and the window extracted from the
/// decoded crop always agree in shape (issue #266): clamping at score time would
/// hand `score_watermark_crop` mismatched dimensions, and its length guard turns
/// that into a silent zero. The 3x3 floor is Sobel's - `sobel_magnitude` zeroes
/// anything smaller, which would score 0 forever and read as a permanently
/// missing mark rather than the pool problem it is.
pub fn scoring_subwindow(reference: &CropRegion, crop: &CropRegion) -> Option<CropRegion> {
    // Edges in u64 so an origin-plus-size near u32::MAX cannot wrap; the result
    // fits u32 again because it is bounded by the inputs' own coordinates.
    let x1 = u64::from(reference.x.max(crop.x));
    let y1 = u64::from(reference.y.max(crop.y));
    let x2 = (u64::from(reference.x) + u64::from(reference.width))
        .min(u64::from(crop.x) + u64::from(crop.width));
    let y2 = (u64::from(reference.y) + u64::from(reference.height))
        .min(u64::from(crop.y) + u64::from(crop.height));

    if x2 <= x1 || y2 <= y1 {
        return None;
    }
    let width = x2 - x1;
    let height = y2 - y1;
    if width < 3 || height < 3 {
        return None;
    }

    Some(CropRegion {
        x: x1 as u32,
        y: y1 as u32,
        width: width as u32,
        height: height as u32,
    })
}

/// True when a reference's mark spans more than half its canvas on either axis.
///
/// Corner marks measure ~8% of the frame; a mark past half of it is a
/// banner-class asset - the kind whose bbox swallowed both corners' inspection
/// regions under the old union design (issue #266). It is still scored, over
/// its own subwindow, but every report names it so a stray asset in the pool is
/// loud instead of silently odd.
pub fn is_wide_mark(bbox: &AlphaBbox, canvas_width: u32, canvas_height: u32) -> bool {
    u64::from(bbox.width()) * 2 > u64::from(canvas_width)
        || u64::from(bbox.height()) * 2 > u64::from(canvas_height)
}

/// Puts a region of exactly the given size at another's origin.
///
/// Both corners must be cropped at **exactly** the same size or `hstack` refuses
/// to combine them, and the two corners' unions are rarely the same shape. So the
/// size is authoritative here and the origin gives way: a region that would
/// overhang the frame is shifted back inside rather than shrunk, because a
/// shrunken crop on one corner and not the other breaks the graph outright.
///
/// Shifting moves the inspection window by a handful of pixels at most, since the
/// sizes involved differ by that much. If the size itself exceeds the frame there
/// is nothing to shift into, and it is truncated as a last resort.
pub fn place_region(
    region: &CropRegion,
    width: u32,
    height: u32,
    video_width: u32,
    video_height: u32,
) -> CropRegion {
    let width = width.min(video_width).max(1);
    let height = height.min(video_height).max(1);

    CropRegion {
        x: region.x.min(video_width - width),
        y: region.y.min(video_height - height),
        width,
        height,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The measured bboxes from the real brand assets (issue #180 calibration
    /// comment). Used as the arithmetic's ground truth rather than invented
    /// numbers, so a change in the scaling rule shows up against reality.
    const REF_1080_LEFT: AlphaBbox = AlphaBbox {
        x1: 20,
        y1: 20,
        x2: 167,
        y2: 167,
    };
    const REF_1080_RIGHT: AlphaBbox = AlphaBbox {
        x1: 1751,
        y1: 20,
        x2: 1898,
        y2: 167,
    };
    const REF_4K_RIGHT: AlphaBbox = AlphaBbox {
        x1: 3505,
        y1: 40,
        x2: 3799,
        y2: 333,
    };

    #[test]
    fn b3_2_reads_the_left_corner_off_the_reference_alpha() {
        assert_eq!(corner_of(&REF_1080_LEFT, 1920), Corner::TopLeft);
    }

    #[test]
    fn b3_1_reads_the_right_corner_off_the_reference_alpha() {
        assert_eq!(corner_of(&REF_1080_RIGHT, 1920), Corner::TopRight);
        assert_eq!(
            corner_of(&REF_4K_RIGHT, 3840),
            Corner::TopRight,
            "the 4K variant of the same asset must read the same corner"
        );
    }

    #[test]
    fn decides_the_corner_on_the_box_centre_not_its_left_edge() {
        // A box whose left edge is in the left half but whose centre is in the right.
        // The brand does not produce one, but the rule has to be the documented one:
        // deciding on the left edge alone gives the opposite answer here, and both
        // rules agree on every real asset, so nothing else would catch the swap.
        let straddling = AlphaBbox {
            x1: 900,
            y1: 20,
            x2: 1100,
            y2: 220,
        };

        assert_eq!(corner_of(&straddling, 1920), Corner::TopRight);
    }

    #[test]
    fn b3_6_scales_a_1080p_reference_onto_a_4k_frame() {
        // The 4K asset exists in the pool and was measured at x 3505-3799,
        // y 40-333. Scaling the 1080p box lands within a few pixels of it: the
        // assets are hand-made at roughly 2x, not exactly 2x. Asserting equality
        // would be asserting a coincidence, so this asserts the tolerance the
        // union of regions is there to absorb.
        let region = scale_bbox(&REF_1080_RIGHT, 1920, 1080, 3840, 2160);

        assert!(
            region.x.abs_diff(REF_4K_RIGHT.x1) <= 4,
            "scaled x {} should land near the measured 4K x {}",
            region.x,
            REF_4K_RIGHT.x1
        );
        assert!(
            region.width.abs_diff(REF_4K_RIGHT.width()) <= 4,
            "scaled width {} should land near the measured 4K width {}",
            region.width,
            REF_4K_RIGHT.width()
        );
        assert_eq!(region.y, 40, "the inset scales with the frame height too");
    }

    #[test]
    fn b3_6_scales_a_4k_reference_down_onto_a_1080p_frame() {
        let region = scale_bbox(&REF_4K_RIGHT, 3840, 2160, 1920, 1080);

        assert!(
            region.x.abs_diff(REF_1080_RIGHT.x1) <= 4,
            "got {:?}",
            region
        );
        assert!(
            region.width.abs_diff(REF_1080_RIGHT.width()) <= 4,
            "got {:?}",
            region
        );
    }

    #[test]
    fn b12_4_computes_the_region_from_a_vertical_video_own_dimensions() {
        // A 1080x1920 render. Scaling by the frame's real dimensions is the whole
        // point: a region derived from the reference's aspect ratio would fall
        // outside the frame entirely.
        let region = scale_bbox(&REF_1080_RIGHT, 1920, 1080, 1080, 1920);

        assert!(
            region.x + region.width <= 1080,
            "region {:?} must stay inside a 1080-wide frame",
            region
        );
        assert!(
            region.y + region.height <= 1920,
            "region {:?} must stay inside a 1920-tall frame",
            region
        );
        assert!(
            region.x > 540,
            "a right-corner mark stays on the right half"
        );
    }

    #[test]
    fn keeps_an_oversized_region_inside_the_frame() {
        // A reference bigger than the video would otherwise build a crop ffmpeg
        // rejects, turning a tolerable mismatch into an opaque filter error.
        let huge = AlphaBbox {
            x1: 0,
            y1: 0,
            x2: 4000,
            y2: 3000,
        };

        let region = scale_bbox(&huge, 4001, 3001, 640, 360);

        assert_eq!(region.x + region.width, 640);
        assert_eq!(region.y + region.height, 360);
    }

    #[test]
    fn i266_b1_3_scoring_subwindow_clamps_to_the_placed_crop() {
        // A reference region partly outside the placed crop is scored over the
        // visible part, computed at prepare time so template and extracted crop
        // always agree in shape (issue #266, D2).
        let reference = CropRegion {
            x: 100,
            y: 100,
            width: 50,
            height: 50,
        };
        let crop = CropRegion {
            x: 120,
            y: 90,
            width: 100,
            height: 100,
        };

        let subwindow = scoring_subwindow(&reference, &crop).expect("the overlap is scoreable");

        assert_eq!(
            subwindow,
            CropRegion {
                x: 120,
                y: 100,
                width: 30,
                height: 50
            }
        );
    }

    #[test]
    fn i266_b1_3_scoring_subwindow_is_the_reference_region_when_fully_inside() {
        let reference = CropRegion {
            x: 3505,
            y: 40,
            width: 295,
            height: 294,
        };
        let crop = CropRegion {
            x: 40,
            y: 40,
            width: 3762,
            height: 384,
        };

        assert_eq!(scoring_subwindow(&reference, &crop), Some(reference));
    }

    #[test]
    fn i266_b1_4_scoring_subwindow_rejects_an_empty_or_degenerate_overlap() {
        // Sobel zeroes the border of anything under 3x3, so a degenerate sliver
        // would score 0 forever and read as a permanently absent mark. Skipping
        // it (with a note upstream) is the honest answer (issue #266, D2).
        let crop = CropRegion {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        };
        let disjoint = CropRegion {
            x: 200,
            y: 200,
            width: 50,
            height: 50,
        };
        let sliver = CropRegion {
            x: 98,
            y: 0,
            width: 50,
            height: 50,
        };

        assert_eq!(scoring_subwindow(&disjoint, &crop), None);
        assert_eq!(
            scoring_subwindow(&sliver, &crop),
            None,
            "a 2px-wide overlap cannot carry a Sobel gradient"
        );
    }

    #[test]
    fn i266_b2_flags_a_mark_spanning_more_than_half_its_canvas_on_either_axis() {
        // The real banner: 1881x192 on a 1920x1080 canvas - wide, not tall.
        let banner = AlphaBbox {
            x1: 20,
            y1: 20,
            x2: 1900,
            y2: 211,
        };
        // A hypothetical side banner causes the same region inflation vertically.
        let tall = AlphaBbox {
            x1: 20,
            y1: 20,
            x2: 219,
            y2: 919,
        };

        assert!(is_wide_mark(&banner, 1920, 1080));
        assert!(is_wide_mark(&tall, 1920, 1080));
    }

    #[test]
    fn i266_b2_does_not_flag_a_real_corner_mark() {
        // Real marks are ~7.7% of the frame width; exactly half is also not
        // "spanning most of the frame".
        let exactly_half = AlphaBbox {
            x1: 0,
            y1: 0,
            x2: 959,
            y2: 99,
        };

        assert!(!is_wide_mark(&REF_1080_RIGHT, 1920, 1080));
        assert!(!is_wide_mark(&REF_4K_RIGHT, 3840, 2160));
        assert!(!is_wide_mark(&exactly_half, 1920, 1080));
    }

    #[test]
    fn union_covers_both_regions() {
        let a = CropRegion {
            x: 3502,
            y: 40,
            width: 296,
            height: 296,
        };
        let b = CropRegion {
            x: 3505,
            y: 40,
            width: 295,
            height: 294,
        };

        let merged = union(&a, &b);

        assert_eq!(merged.x, 3502);
        assert_eq!(merged.x + merged.width, 3800);
        assert_eq!(merged.height, 296);
    }

    #[test]
    fn place_region_keeps_the_origin_and_takes_the_common_size() {
        let left = CropRegion {
            x: 20,
            y: 20,
            width: 148,
            height: 148,
        };

        let sized = place_region(&left, 160, 150, 1920, 1080);

        assert_eq!(
            sized,
            CropRegion {
                x: 20,
                y: 20,
                width: 160,
                height: 150
            }
        );
    }

    #[test]
    fn place_region_shifts_rather_than_shrinks_an_overhanging_region() {
        // Both corners must crop at identical sizes or hstack refuses the graph,
        // so the size has to survive and the origin has to move.
        let right = CropRegion {
            x: 1898,
            y: 20,
            width: 22,
            height: 148,
        };

        let sized = place_region(&right, 30, 148, 1920, 1080);

        assert_eq!(sized.width, 30, "the common size must be preserved exactly");
        assert_eq!(sized.x, 1890, "the window shifts back inside the frame");
        assert_eq!(sized.x + sized.width, 1920);
    }

    #[test]
    fn place_region_truncates_a_size_larger_than_the_frame() {
        let region = CropRegion {
            x: 10,
            y: 10,
            width: 100,
            height: 100,
        };

        let sized = place_region(&region, 900, 900, 640, 360);

        assert_eq!(
            sized,
            CropRegion {
                x: 0,
                y: 0,
                width: 640,
                height: 360
            }
        );
    }
}
