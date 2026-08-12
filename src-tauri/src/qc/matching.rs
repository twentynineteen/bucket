//! Watermark matching: Sobel gradient magnitude + weighted normalised
//! cross-correlation (issue #180, stage 2, B3).
//!
//! ## What is correlated, and why
//!
//! The template is the Sobel gradient of the **reference's alpha map**, not of the
//! reference composited over anything. The brand assets are a flat colour plus a
//! varying alpha mask: the Black variant is luma 0 everywhere, the White variant luma
//! 255 everywhere, and both carry the same alpha map peaking at 137 of 255. So the
//! mark is never more than 54% opaque, the backdrop always shows through it, and its
//! composited appearance depends entirely on the footage behind it — black at 54% over
//! dark footage reads strongly, white at 54% over a bright office barely shifts the
//! luma.
//!
//! The alpha map is the backdrop-invariant. Normalised cross-correlation then absorbs
//! the backdrop-dependent difference in signal strength as a scale factor, which is
//! what lets one template match both colour variants over both kinds of footage:
//! presence measured 0.9803 to 0.9973 across two real renders, against absence of
//! -0.1483 to 0.0135.
//!
//! Two consequences worth stating:
//!
//! - **Matching is colour-agnostic.** Black and White share an alpha map, so one
//!   template covers both and `dedupe_by_alpha` drops the duplicate. Only Left and
//!   Right differ, and that is a position difference.
//! - **Invariance is to backdrop *luma*, not backdrop *texture*.** Correlating a
//!   scaled copy of the same structure is what NCC is good at; footage whose own
//!   edges fall inside the mark is not something this has been shown to survive, and
//!   is not claimed (B3.5).
//!
//! ## Sobel runs here, not in ffmpeg
//!
//! Not a style preference. ffmpeg's `sobel` filter works at 8-bit and **clips**, and
//! alpha-map edges (delta up to 137) overflow far more than a grey composite's, so the
//! two stop being proportional and the correlation becomes meaningless. An earlier
//! round of measurement that put presence as low as 0.389 was entirely this artefact.
//! `sobel_magnitude` accumulates in `f32` so there is headroom, and it must not be
//! swapped back for the filter.
//!
//! It is also free — the crop is at most a few hundred pixels square — and it puts both
//! sides of the comparison through the same Rust code, testable against synthetic
//! arrays with no decoder in the way.

use super::geometry::Corner;

/// A reference watermark prepared for correlation against a video frame.
///
/// Both planes are already cropped to the corner's inspection region and scaled
/// to the video's dimensions, so a template is only valid for the video it was
/// prepared for.
#[derive(Debug, Clone)]
pub struct WatermarkTemplate {
    /// The reference file this came from, so a report can name what matched.
    pub name: String,
    pub corner: Corner,
    /// The reference's alpha map over the region, kept so identical templates can
    /// be recognised and dropped.
    pub alpha: Vec<u8>,
    /// Sobel magnitude of the reference's **alpha map** over the inspection region.
    pub gradient: Vec<f32>,
    /// Per-pixel correlation weights.
    pub weights: Vec<f32>,
    pub width: usize,
    pub height: usize,
}

/// Drops templates whose alpha map is identical to one already kept.
///
/// The Black and White variants of a mark are the same shape at the same opacity in
/// different colours, so they carry byte-identical alpha maps and score identically.
/// Matching against both costs twice the correlation for no extra coverage. Only
/// Left and Right are genuinely different, and that is a position difference the
/// corner already expresses.
///
/// The survivor keeps its own filename. A report naming it is naming the mark's
/// shape and position rather than its colour, which is worth saying out loud
/// wherever the name is shown.
pub fn dedupe_by_alpha(templates: Vec<WatermarkTemplate>) -> Vec<WatermarkTemplate> {
    let mut kept: Vec<WatermarkTemplate> = Vec::new();

    for template in templates {
        let duplicate = kept
            .iter()
            .any(|existing| existing.corner == template.corner && existing.alpha == template.alpha);
        if !duplicate {
            kept.push(template);
        }
    }

    kept
}

/// What one sampled frame turned out to hold.
#[derive(Debug, Clone, PartialEq)]
pub struct SampleEvaluation {
    /// The corner the mark was found in, or `None` when nothing matched.
    pub corner: Option<Corner>,
    /// The best score seen across every reference and both corners.
    pub confidence: f32,
    /// Which reference produced that best score.
    pub reference: Option<String>,
}

/// Sobel gradient magnitude of an 8-bit greyscale plane, accumulated in `f32`.
///
/// The headroom is the point. An 8-bit Sobel clips, and it clips unevenly between an
/// alpha map and a luma composite because their edge deltas differ by roughly 2x, which
/// destroys the proportionality normalised correlation depends on. This is why ffmpeg's
/// `sobel` filter is not used.
///
/// The border pixels are left at zero rather than being extended or wrapped: a
/// one-pixel frame around a region of at least a hundred pixels square changes
/// no verdict, and inventing edge pixels would put a synthetic gradient into the
/// correlation.
pub fn sobel_magnitude(pixels: &[u8], width: usize, height: usize) -> Vec<f32> {
    let mut out = vec![0.0f32; width * height];
    if width < 3 || height < 3 || pixels.len() < width * height {
        return out;
    }

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let at = |dx: isize, dy: isize| -> f32 {
                let px = (x as isize + dx) as usize;
                let py = (y as isize + dy) as usize;
                f32::from(pixels[py * width + px])
            };

            let gx =
                -at(-1, -1) - 2.0 * at(-1, 0) - at(-1, 1) + at(1, -1) + 2.0 * at(1, 0) + at(1, 1);
            let gy =
                -at(-1, -1) - 2.0 * at(0, -1) - at(1, -1) + at(-1, 1) + 2.0 * at(0, 1) + at(1, 1);

            out[y * width + x] = (gx * gx + gy * gy).sqrt();
        }
    }

    out
}

/// Weighted normalised cross-correlation of two equally sized signals, in
/// `[-1, 1]`.
///
/// Returns 0 when either signal has no weighted variance. That is the honest
/// answer for a flat region: correlation is undefined, and returning 1 for "two
/// featureless things look alike" would pass every blank corner ever rendered.
pub fn weighted_ncc(a: &[f32], b: &[f32], weights: &[f32]) -> f32 {
    let n = a.len().min(b.len()).min(weights.len());
    if n == 0 {
        return 0.0;
    }

    let total_weight: f64 = weights[..n].iter().map(|w| f64::from(*w)).sum();
    if total_weight <= f64::EPSILON {
        return 0.0;
    }

    let mean = |v: &[f32]| -> f64 {
        v[..n]
            .iter()
            .zip(&weights[..n])
            .map(|(x, w)| f64::from(*x) * f64::from(*w))
            .sum::<f64>()
            / total_weight
    };

    let (mean_a, mean_b) = (mean(a), mean(b));

    let mut covariance = 0.0f64;
    let mut variance_a = 0.0f64;
    let mut variance_b = 0.0f64;

    for i in 0..n {
        let w = f64::from(weights[i]);
        let da = f64::from(a[i]) - mean_a;
        let db = f64::from(b[i]) - mean_b;
        covariance += w * da * db;
        variance_a += w * da * da;
        variance_b += w * db * db;
    }

    if variance_a <= f64::EPSILON || variance_b <= f64::EPSILON {
        return 0.0;
    }

    ((covariance / (variance_a * variance_b).sqrt()) as f32).clamp(-1.0, 1.0)
}

/// Scores one greyscale crop against one template, in `[-1, 1]`.
///
/// **This is the feature extraction seam.** Everything above it — sampling, gap
/// coalescing, evidence, the IPC shapes — depends only on the number this returns, so
/// the scoring can change without any of them moving. It has changed once already:
/// building the template from the composited reference rather than its alpha map put
/// measured presence as low as 0.389, and correcting it needed no change anywhere
/// else. Keep it that way.
pub fn score_watermark_crop(crop: &[u8], template: &WatermarkTemplate) -> f32 {
    if crop.len() < template.width * template.height {
        return 0.0;
    }
    let gradient = sobel_magnitude(crop, template.width, template.height);
    weighted_ncc(&gradient, &template.gradient, &template.weights)
}

/// Evaluates one sampled frame's corner crops against every template.
///
/// Every template is tried against the crop for its own corner, and the best
/// score across all of them wins: the pool holds Black and White variants of the
/// same mark for light and dark footage, and any of them matching is a pass.
///
/// A score at or above the threshold is a match. The comparison is `>=` so a
/// threshold of exactly the measured score still passes, which matters when an
/// operator copies a number out of the report into the override field.
pub fn evaluate_sample(
    crops: &[(Corner, &[u8])],
    templates: &[WatermarkTemplate],
    threshold: f32,
) -> SampleEvaluation {
    let mut best = SampleEvaluation {
        corner: None,
        confidence: 0.0,
        reference: None,
    };

    for template in templates {
        let Some((corner, crop)) = crops.iter().find(|(corner, _)| *corner == template.corner)
        else {
            continue;
        };

        let score = score_watermark_crop(crop, template);
        if best.reference.is_some() && score <= best.confidence {
            continue;
        }

        best.confidence = score;
        best.reference = Some(template.name.clone());
        best.corner = if score >= threshold {
            Some(*corner)
        } else {
            None
        };
    }

    best
}

#[cfg(test)]
mod tests {
    use super::*;

    const REGION: usize = 32;

    /// The tests' own cutoff. It happens to equal the shipped default, but these
    /// tests assert the *ordering* of scores and the comparison against whatever
    /// threshold they are handed, so a retune cannot break them.
    const CUTOFF: f32 = 0.85;

    /// Peak alpha of the real brand assets: 137 of 255, so 54% opacity.
    const PEAK_ALPHA: u8 = 137;

    /// A reference's alpha map: an outer box, a hole and a centre dot.
    ///
    /// Structure is the point — a plain filled square correlates with any other plain
    /// filled square — and it lives in *alpha*, which is where the real assets keep it.
    fn alpha_map() -> Vec<u8> {
        let mut alpha = vec![0u8; REGION * REGION];
        for y in 4..28 {
            for x in 4..28 {
                alpha[y * REGION + x] = PEAK_ALPHA;
            }
        }
        for y in 10..22 {
            for x in 10..22 {
                alpha[y * REGION + x] = 0;
            }
        }
        for y in 14..18 {
            for x in 14..18 {
                alpha[y * REGION + x] = PEAK_ALPHA;
            }
        }
        alpha
    }

    /// The alpha map composited over a uniform backdrop, as a frame would show it.
    ///
    /// `out = backdrop * (1 - a) + colour * a`, which is what `overlay` computes. This
    /// is the whole reason the template comes from alpha: change `colour` or `backdrop`
    /// and the composite changes completely while the alpha map does not.
    fn composite(colour: u8, backdrop: u8) -> Vec<u8> {
        alpha_map()
            .iter()
            .map(|a| {
                let opacity = f32::from(*a) / 255.0;
                (f32::from(backdrop) * (1.0 - opacity) + f32::from(colour) * opacity).round() as u8
            })
            .collect()
    }

    fn template(corner: Corner, name: &str) -> WatermarkTemplate {
        WatermarkTemplate {
            name: name.to_string(),
            corner,
            alpha: alpha_map(),
            gradient: sobel_magnitude(&alpha_map(), REGION, REGION),
            weights: vec![1.0; REGION * REGION],
            width: REGION,
            height: REGION,
        }
    }

    /// Footage: a diagonal ramp. Plenty of gradient, none of the mark's structure.
    fn footage() -> Vec<u8> {
        let mut pixels = vec![0u8; REGION * REGION];
        for y in 0..REGION {
            for x in 0..REGION {
                pixels[y * REGION + x] = ((x + y) * 4) as u8;
            }
        }
        pixels
    }

    #[test]
    fn sobel_finds_a_vertical_edge_and_ignores_flat_areas() {
        let width = 5;
        let height = 5;
        let mut pixels = vec![0u8; width * height];
        for y in 0..height {
            for x in 3..width {
                pixels[y * width + x] = 255;
            }
        }

        let gradient = sobel_magnitude(&pixels, width, height);

        assert!(
            gradient[2 * width + 2] > 500.0,
            "the edge column should carry a large magnitude, got {}",
            gradient[2 * width + 2]
        );
        assert_eq!(
            gradient[2 * width + 1], 0.0,
            "a flat interior pixel has no gradient"
        );
    }

    #[test]
    fn sobel_keeps_headroom_past_what_eight_bits_could_hold() {
        // The bug this guards is subtle and was measured: an 8-bit Sobel clips, and it
        // clips differently for an alpha map than for a luma composite because their
        // edge deltas differ by roughly 2x. Once clipped they stop being proportional,
        // normalised correlation stops meaning anything, and presence measured 0.389
        // instead of 0.98.
        let width = 5;
        let height = 5;
        let mut pixels = vec![0u8; width * height];
        for y in 0..height {
            for x in 3..width {
                pixels[y * width + x] = 255;
            }
        }

        let gradient = sobel_magnitude(&pixels, width, height);

        assert!(
            gradient.iter().cloned().fold(0.0f32, f32::max) > 255.0,
            "a full-scale edge exceeds 8 bits and must not be clipped to it"
        );
    }

    #[test]
    fn ncc_is_one_for_identical_signals() {
        let a = vec![1.0, 5.0, 2.0, 9.0];
        let weights = vec![1.0; 4];

        assert!((weighted_ncc(&a, &a, &weights) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn ncc_is_one_for_a_uniformly_scaled_copy() {
        // The property the whole approach rests on: a semi-transparent mark over a
        // different backdrop produces the same structure at a different amplitude, and
        // correlation has to see through that.
        let a = vec![1.0, 5.0, 2.0, 9.0, 3.0];
        let scaled: Vec<f32> = a.iter().map(|v| v * 0.17).collect();

        assert!((weighted_ncc(&a, &scaled, &vec![1.0; 5]) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn ncc_is_zero_for_a_signal_with_no_variance() {
        // A blank corner. Correlation is undefined, and answering "1" would pass
        // every featureless region ever rendered.
        let flat = vec![3.0; 8];
        let varied = vec![1.0, 4.0, 2.0, 8.0, 3.0, 7.0, 5.0, 6.0];

        assert_eq!(weighted_ncc(&flat, &varied, &vec![1.0; 8]), 0.0);
    }

    #[test]
    fn ncc_weights_exclude_pixels_a_mask_zeroes_out() {
        // Not used by the current template, which weights uniformly, but it is the
        // primitive a future glyph-stroke mask would be built on.
        let a = vec![1.0, 5.0, 2.0, 9.0, 200.0, 0.0];
        let b = vec![1.0, 5.0, 2.0, 9.0, 0.0, 200.0];
        let weights = vec![1.0, 1.0, 1.0, 1.0, 0.0, 0.0];

        assert!((weighted_ncc(&a, &b, &weights) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn b3_1_passes_with_the_corner_recorded_as_top_right() {
        let blank = vec![40u8; REGION * REGION];
        let marked = composite(0, 200);

        let result = evaluate_sample(
            &[(Corner::TopLeft, &blank), (Corner::TopRight, &marked)],
            &[
                template(Corner::TopLeft, "left.png"),
                template(Corner::TopRight, "right.png"),
            ],
            CUTOFF,
        );

        assert_eq!(result.corner, Some(Corner::TopRight));
        assert_eq!(result.reference.as_deref(), Some("right.png"));
        assert!(result.confidence >= CUTOFF, "got {}", result.confidence);
    }

    #[test]
    fn b3_2_passes_with_the_corner_recorded_as_top_left() {
        let blank = vec![40u8; REGION * REGION];
        let marked = composite(0, 200);

        let result = evaluate_sample(
            &[(Corner::TopLeft, &marked), (Corner::TopRight, &blank)],
            &[
                template(Corner::TopLeft, "left.png"),
                template(Corner::TopRight, "right.png"),
            ],
            CUTOFF,
        );

        assert_eq!(result.corner, Some(Corner::TopLeft));
    }

    #[test]
    fn b3_3_fails_when_neither_corner_holds_the_mark() {
        let result = evaluate_sample(
            &[(Corner::TopLeft, &footage()), (Corner::TopRight, &footage())],
            &[
                template(Corner::TopLeft, "left.png"),
                template(Corner::TopRight, "right.png"),
            ],
            CUTOFF,
        );

        assert_eq!(result.corner, None);
        assert!(
            result.confidence < CUTOFF,
            "a gradient-rich non-match must score below threshold, got {}",
            result.confidence
        );
    }

    #[test]
    fn b3_4_fails_on_a_bright_busy_graphic_that_is_not_the_mark() {
        // Brightness alone must not pass. This block is brighter than the mark and full
        // of edges, but its structure is a checkerboard, not the logo.
        let mut busy = vec![255u8; REGION * REGION];
        for y in 0..REGION {
            for x in 0..REGION {
                if (x / 2 + y / 2) % 2 == 0 {
                    busy[y * REGION + x] = 40;
                }
            }
        }

        let result = evaluate_sample(
            &[(Corner::TopRight, &busy)],
            &[template(Corner::TopRight, "right.png")],
            CUTOFF,
        );

        assert_eq!(result.corner, None, "confidence was {}", result.confidence);
    }

    #[test]
    fn b3_4_fails_a_partial_match_that_scores_between_zero_and_the_threshold() {
        // A plain box at the mark's outer extent with none of its internal structure.
        // It correlates positively and still has to fail, which pins the threshold
        // comparison rather than merely the sign of the score. A test using only wildly
        // non-matching input passes even with the threshold dropped to zero.
        let mut box_only_alpha = vec![0u8; REGION * REGION];
        for y in 4..28 {
            for x in 4..28 {
                box_only_alpha[y * REGION + x] = PEAK_ALPHA;
            }
        }
        let box_only: Vec<u8> = box_only_alpha
            .iter()
            .map(|a| {
                let opacity = f32::from(*a) / 255.0;
                (200.0 * (1.0 - opacity)).round() as u8
            })
            .collect();

        let result = evaluate_sample(
            &[(Corner::TopRight, &box_only)],
            &[template(Corner::TopRight, "right.png")],
            CUTOFF,
        );

        assert!(
            result.confidence > 0.0 && result.confidence < CUTOFF,
            "the fixture must sit between zero and the threshold to be worth anything, got {}",
            result.confidence
        );
        assert_eq!(result.corner, None, "a partial match is not a match");
    }

    #[test]
    fn scores_rank_a_genuine_mark_above_a_partial_one_above_footage() {
        // The claim that survives any retuning of the threshold, and the one a
        // replacement scorer has to keep.
        let template = template(Corner::TopRight, "right.png");

        let mut box_only_alpha = vec![0u8; REGION * REGION];
        for y in 4..28 {
            for x in 4..28 {
                box_only_alpha[y * REGION + x] = PEAK_ALPHA;
            }
        }
        let box_only: Vec<u8> = box_only_alpha
            .iter()
            .map(|a| (200.0 * (1.0 - f32::from(*a) / 255.0)).round() as u8)
            .collect();

        let genuine = score_watermark_crop(&composite(0, 200), &template);
        let partial = score_watermark_crop(&box_only, &template);
        let none = score_watermark_crop(&footage(), &template);

        assert!(genuine > partial, "genuine {} vs partial {}", genuine, partial);
        assert!(partial > none, "partial {} vs footage {}", partial, none);
    }

    #[test]
    fn a_score_exactly_on_the_threshold_counts_as_a_match() {
        // An operator reading a score out of a report and typing it into the override
        // field must not get a failure on the very frame they took it from, so the
        // comparison is inclusive. Correlating the alpha map against itself scores
        // exactly 1.0, which makes a threshold of 1.0 the only way to pin the boundary
        // rather than the margin.
        let result = evaluate_sample(
            &[(Corner::TopRight, &alpha_map())],
            &[template(Corner::TopRight, "right.png")],
            1.0,
        );

        assert_eq!(result.confidence, 1.0);
        assert_eq!(result.corner, Some(Corner::TopRight));
    }

    #[test]
    fn b3_5_matches_the_same_mark_in_either_colour_over_either_backdrop() {
        // The behaviour, stated as strongly as the measurements allow. The template is
        // the alpha map's gradient structure, which is invariant to backdrop luma up to
        // a scale factor that normalised correlation divides out — so a black mark over
        // light footage and a white mark over dark footage both match the one template.
        // Measured on real renders at 0.9803 to 0.9973 across exactly this pair of
        // cases.
        //
        // Invariance to backdrop *texture* is a different claim and is not made:
        // uniform backdrops here, deliberately.
        let template = template(Corner::TopRight, "right.png");

        let black_on_light = score_watermark_crop(&composite(0, 200), &template);
        let white_on_dark = score_watermark_crop(&composite(255, 40), &template);

        assert!(
            black_on_light >= CUTOFF,
            "black at 54% over light footage should match, got {}",
            black_on_light
        );
        assert!(
            white_on_dark >= CUTOFF,
            "white at 54% over dark footage should match, got {}",
            white_on_dark
        );
    }

    #[test]
    fn b3_5_barely_moves_the_score_when_only_the_backdrop_luma_changes() {
        let template = template(Corner::TopRight, "right.png");

        let over_light = score_watermark_crop(&composite(0, 220), &template);
        let over_mid = score_watermark_crop(&composite(0, 120), &template);

        assert!(
            (over_light - over_mid).abs() < 0.05,
            "backdrop luma should be normalised away: {} against {}",
            over_light,
            over_mid
        );
    }

    #[test]
    fn b3_6_reaches_the_same_outcome_at_a_doubled_scale() {
        // The same mark and reference at 2x. Scores may differ; the outcome may not.
        // Both are built by the same nearest-neighbour doubling, mirroring the reference
        // and the frame passing through the same scale-then-crop.
        let double = |src: &[u8]| -> Vec<u8> {
            let mut out = vec![0u8; REGION * 2 * REGION * 2];
            for y in 0..REGION * 2 {
                for x in 0..REGION * 2 {
                    out[y * REGION * 2 + x] = src[(y / 2) * REGION + (x / 2)];
                }
            }
            out
        };

        let big_alpha = double(&alpha_map());
        let big_template = WatermarkTemplate {
            name: "right_4k.png".to_string(),
            corner: Corner::TopRight,
            alpha: big_alpha.clone(),
            gradient: sobel_magnitude(&big_alpha, REGION * 2, REGION * 2),
            weights: vec![1.0; REGION * 2 * REGION * 2],
            width: REGION * 2,
            height: REGION * 2,
        };

        let small = evaluate_sample(
            &[(Corner::TopRight, &composite(0, 200))],
            &[template(Corner::TopRight, "right.png")],
            CUTOFF,
        );
        let large = evaluate_sample(
            &[(Corner::TopRight, &double(&composite(0, 200)))],
            &[big_template],
            CUTOFF,
        );

        assert_eq!(small.corner, large.corner);
        assert_eq!(large.corner, Some(Corner::TopRight));
    }

    #[test]
    fn dedupes_colour_variants_that_share_an_alpha_map() {
        // Black and White are the same shape at the same opacity in different colours,
        // so they carry byte-identical alpha maps and score identically. Matching
        // against both doubles the per-sample cost for no extra coverage.
        let templates = vec![
            template(Corner::TopRight, "BlackRight.png"),
            template(Corner::TopRight, "WhiteRight.png"),
            template(Corner::TopLeft, "BlackLeft.png"),
        ];

        let kept = dedupe_by_alpha(templates);

        assert_eq!(kept.len(), 2, "one template per corner, not per colour");
        assert_eq!(kept[0].name, "BlackRight.png", "the first one seen survives");
        assert_eq!(kept[1].corner, Corner::TopLeft);
    }

    #[test]
    fn keeps_two_templates_for_one_corner_when_their_alpha_maps_differ() {
        // A genuinely different mark in the same corner — a rebrand, or a second
        // programme's logo — must not be dropped as a duplicate.
        let mut other = template(Corner::TopRight, "OtherRight.png");
        other.alpha[0] = 1;

        let kept = dedupe_by_alpha(vec![template(Corner::TopRight, "BlackRight.png"), other]);

        assert_eq!(kept.len(), 2);
    }

    #[test]
    fn reports_the_best_confidence_even_when_nothing_matches() {
        // The report shows the score, so a near miss has to be visible rather than
        // collapsing to zero: "0.83 against a 0.85 threshold" is what tells an operator
        // the threshold is the problem.
        let result = evaluate_sample(
            &[(Corner::TopRight, &composite(0, 200))],
            &[template(Corner::TopRight, "right.png")],
            1.1,
        );

        assert_eq!(result.corner, None);
        assert!(result.confidence > 0.0, "the near-miss score must survive");
        assert_eq!(result.reference.as_deref(), Some("right.png"));
    }
}
