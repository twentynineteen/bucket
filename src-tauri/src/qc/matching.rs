//! Watermark matching: Sobel gradient magnitude + weighted normalised
//! cross-correlation (issue #180, stage 2, B3).
//!
//! Why gradients rather than raw luma: the mark is semi-transparent, so its
//! absolute brightness depends on the footage behind it. Its *edge structure*
//! does not, or much less so. Gradient matching is therefore **more robust to
//! opacity than raw luma, not invariant to it** — a mark over busy footage has
//! its edges partly suppressed by the background, and that is a known limitation
//! rather than a guarantee (B3.5). It is why the confidence score is reported
//! rather than hidden.
//!
//! Why weighted: a reference is a full-frame RGBA canvas, so its alpha channel
//! says exactly which pixels the mark covers. Using alpha as the correlation
//! weight means the footage visible around the mark contributes nothing to the
//! score, which is what makes the measured separation so wide (0.98 for a
//! genuine match against 0.01 for a mark-free region of the same size).
//!
//! Sobel runs here rather than in ffmpeg's `sobel` filter. Two reasons: the crop
//! is at most a few hundred pixels square, so it costs nothing, and both sides
//! of the comparison then go through the same Rust code, which is testable
//! against synthetic arrays without a decoder in the way.

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
    /// Sobel magnitude of the reference's luma over the inspection region.
    pub gradient: Vec<f32>,
    /// Alpha, 0-1, used as the correlation weight.
    pub weights: Vec<f32>,
    pub width: usize,
    pub height: usize,
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

/// Sobel gradient magnitude of an 8-bit greyscale image.
///
/// The border pixels are left at zero rather than being extended or wrapped: a
/// one-pixel frame around a region of at least a hundred pixels square changes
/// no verdict, and inventing edge pixels would put a synthetic gradient into the
/// correlation.
pub fn sobel_magnitude(pixels: &[u8], width: usize, height: usize) -> Vec<f32> {
    unimplemented!("red");
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

            let gx = -at(-1, -1) - 2.0 * at(-1, 0) - at(-1, 1) + at(1, -1)
                + 2.0 * at(1, 0)
                + at(1, 1);
            let gy = -at(-1, -1) - 2.0 * at(0, -1) - at(1, -1)
                + at(-1, 1)
                + 2.0 * at(0, 1)
                + at(1, 1);

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
    unimplemented!("red");
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

/// Scores one greyscale crop against one template.
pub fn score_crop(crop: &[u8], template: &WatermarkTemplate) -> f32 {
    unimplemented!("red");
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
    unimplemented!("red");
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

        let score = score_crop(crop, template);
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

    /// A mark with internal structure: an outer box, an inner hole and a centre
    /// dot. Structure is the point — a plain filled square correlates with any
    /// other plain filled square.
    fn mark_pixels(intensity: u8) -> Vec<u8> {
        let mut pixels = vec![0u8; REGION * REGION];
        for y in 4..28 {
            for x in 4..28 {
                pixels[y * REGION + x] = intensity;
            }
        }
        for y in 10..22 {
            for x in 10..22 {
                pixels[y * REGION + x] = 0;
            }
        }
        for y in 14..18 {
            for x in 14..18 {
                pixels[y * REGION + x] = intensity;
            }
        }
        pixels
    }

    /// Alpha covering the mark's outer extent, as a real reference's would.
    fn mark_weights() -> Vec<f32> {
        let mut weights = vec![0.0f32; REGION * REGION];
        for y in 4..28 {
            for x in 4..28 {
                weights[y * REGION + x] = 1.0;
            }
        }
        weights
    }

    fn template(corner: Corner, name: &str) -> WatermarkTemplate {
        WatermarkTemplate {
            name: name.to_string(),
            corner,
            gradient: sobel_magnitude(&mark_pixels(255), REGION, REGION),
            weights: mark_weights(),
            width: REGION,
            height: REGION,
        }
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
    fn ncc_is_one_for_identical_signals() {
        let a = vec![1.0, 5.0, 2.0, 9.0];
        let weights = vec![1.0; 4];

        assert!((weighted_ncc(&a, &a, &weights) - 1.0).abs() < 1e-6);
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
    fn ncc_weights_exclude_pixels_the_mark_does_not_cover() {
        // The trailing half differs wildly, but its weight is zero, so a match
        // over the covered pixels must still score 1. This is what stops the
        // footage around the mark from dominating the score.
        let a = vec![1.0, 5.0, 2.0, 9.0, 200.0, 0.0];
        let b = vec![1.0, 5.0, 2.0, 9.0, 0.0, 200.0];
        let weights = vec![1.0, 1.0, 1.0, 1.0, 0.0, 0.0];

        assert!((weighted_ncc(&a, &b, &weights) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn b3_1_passes_with_the_corner_recorded_as_top_right() {
        let blank = vec![0u8; REGION * REGION];
        let marked = mark_pixels(255);

        let result = evaluate_sample(
            &[(Corner::TopLeft, &blank), (Corner::TopRight, &marked)],
            &[template(Corner::TopLeft, "left.png"), template(Corner::TopRight, "right.png")],
            0.85,
        );

        assert_eq!(result.corner, Some(Corner::TopRight));
        assert_eq!(result.reference.as_deref(), Some("right.png"));
        assert!(result.confidence >= 0.85, "got {}", result.confidence);
    }

    #[test]
    fn b3_2_passes_with_the_corner_recorded_as_top_left() {
        let blank = vec![0u8; REGION * REGION];
        let marked = mark_pixels(255);

        let result = evaluate_sample(
            &[(Corner::TopLeft, &marked), (Corner::TopRight, &blank)],
            &[template(Corner::TopLeft, "left.png"), template(Corner::TopRight, "right.png")],
            0.85,
        );

        assert_eq!(result.corner, Some(Corner::TopLeft));
    }

    #[test]
    fn b3_3_fails_when_neither_corner_holds_the_mark() {
        // Footage, not a mark: a diagonal ramp has plenty of gradient but none of
        // the reference's structure.
        let mut footage = vec![0u8; REGION * REGION];
        for y in 0..REGION {
            for x in 0..REGION {
                footage[y * REGION + x] = ((x + y) * 4) as u8;
            }
        }

        let result = evaluate_sample(
            &[(Corner::TopLeft, &footage), (Corner::TopRight, &footage)],
            &[template(Corner::TopLeft, "left.png"), template(Corner::TopRight, "right.png")],
            0.85,
        );

        assert_eq!(result.corner, None);
        assert!(
            result.confidence < 0.85,
            "a gradient-rich non-match must score below threshold, got {}",
            result.confidence
        );
    }

    #[test]
    fn b3_4_fails_on_a_bright_busy_graphic_that_is_not_the_mark() {
        // Brightness alone must not pass. This block is brighter than the mark
        // and full of edges, but its structure is a checkerboard, not the logo.
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
            0.85,
        );

        assert_eq!(result.corner, None, "confidence was {}", result.confidence);
    }

    #[test]
    fn b3_5_still_passes_at_reduced_opacity_over_a_uniform_background() {
        // A 40%-opacity mark over a mid-grey background. Gradient magnitudes are
        // scaled down by the opacity, and normalised correlation is invariant to
        // that scale — which is why gradients beat raw luma here. Deliberately a
        // uniform background: over busy footage the background's own edges
        // intrude, and this is explicitly not claimed to be opacity-invariant.
        let opacity = 0.4f32;
        let background = 110.0f32;
        let faded: Vec<u8> = mark_pixels(255)
            .iter()
            .map(|p| {
                (background * (1.0 - opacity) + f32::from(*p) * opacity).round() as u8
            })
            .collect();

        let result = evaluate_sample(
            &[(Corner::TopRight, &faded)],
            &[template(Corner::TopRight, "right.png")],
            0.85,
        );

        assert_eq!(
            result.corner,
            Some(Corner::TopRight),
            "confidence was {}",
            result.confidence
        );
    }

    #[test]
    fn b3_6_reaches_the_same_outcome_at_a_doubled_scale() {
        // The same mark and reference at 2x. Scores may differ; the outcome may
        // not. Both are built by the same nearest-neighbour doubling, mirroring
        // the reference and the frame passing through the same scale-then-crop.
        let double = |src: &[u8]| -> Vec<u8> {
            let mut out = vec![0u8; REGION * 2 * REGION * 2];
            for y in 0..REGION * 2 {
                for x in 0..REGION * 2 {
                    out[y * REGION * 2 + x] = src[(y / 2) * REGION + (x / 2)];
                }
            }
            out
        };
        let double_weights = |src: &[f32]| -> Vec<f32> {
            let mut out = vec![0.0f32; REGION * 2 * REGION * 2];
            for y in 0..REGION * 2 {
                for x in 0..REGION * 2 {
                    out[y * REGION * 2 + x] = src[(y / 2) * REGION + (x / 2)];
                }
            }
            out
        };

        let big_mark = double(&mark_pixels(255));
        let big_template = WatermarkTemplate {
            name: "right_4k.png".to_string(),
            corner: Corner::TopRight,
            gradient: sobel_magnitude(&big_mark, REGION * 2, REGION * 2),
            weights: double_weights(&mark_weights()),
            width: REGION * 2,
            height: REGION * 2,
        };

        let small = evaluate_sample(
            &[(Corner::TopRight, &mark_pixels(255))],
            &[template(Corner::TopRight, "right.png")],
            0.85,
        );
        let large = evaluate_sample(&[(Corner::TopRight, &big_mark)], &[big_template], 0.85);

        assert_eq!(small.corner, large.corner);
        assert_eq!(large.corner, Some(Corner::TopRight));
    }

    #[test]
    fn reports_the_best_confidence_even_when_nothing_matches() {
        // The report shows the score, so a near miss has to be visible rather
        // than collapsing to zero: "0.83 against a 0.85 threshold" is what tells
        // an operator the threshold is the problem.
        let mut faint = mark_pixels(255);
        for pixel in faint.iter_mut() {
            *pixel = (f32::from(*pixel) * 0.02) as u8;
        }

        let result = evaluate_sample(
            &[(Corner::TopRight, &faint)],
            &[template(Corner::TopRight, "right.png")],
            1.1,
        );

        assert_eq!(result.corner, None);
        assert!(result.confidence > 0.0, "the near-miss score must survive");
        assert_eq!(result.reference.as_deref(), Some("right.png"));
    }
}
