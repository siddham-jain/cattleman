/**
 * Preprocessing and post-processing shared by the native and web classifiers.
 *
 * These steps must match ml/data.py's eval transform exactly — resize the short
 * side, centre crop, scale to [0,1], then normalise with ImageNet statistics. A
 * mismatch does not throw; it quietly shifts every prediction. Keeping the maths
 * in one file is what stops the two platforms drifting apart.
 *
 * The tensor type differs per platform, so this returns a plain Float32Array and
 * each classifier wraps it in its own runtime's Tensor.
 */

/** Short side is resized to this multiple of the crop before centre-cropping. */
export const RESIZE_RATIO = 1.14;

/**
 * RGBA bytes -> planar NCHW float data.
 *
 * The alpha channel is dropped and channels are separated, because ONNX wants
 * planar CHW rather than the interleaved layout every image decoder produces.
 */
export function toPlanarFloat32(pixels, size, normalization) {
  const { mean, std } = normalization;
  const expected = size * size * 4;
  if (pixels.length < expected) {
    throw new Error(`Expected ${expected} RGBA bytes for ${size}x${size}, got ${pixels.length}`);
  }
  const data = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      const value = pixels[i * 4 + c] / 255;
      data[c * plane + i] = (value - mean[c]) / std[c];
    }
  }
  return data;
}

export function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((value) => Math.exp(value - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((value) => value / sum);
}

/**
 * Every breed ranked by probability.
 *
 * The full ranking is returned rather than one answer: with the accuracy this
 * model achieves, a field worker is better served choosing from a shortlist than
 * being told a single breed with false authority.
 */
export function rankBreeds(logits, { classes, animal_type: animalTypes }) {
  const probabilities = softmax(logits);
  return classes
    .map((breed, index) => ({
      breed,
      confidence: probabilities[index],
      animalType: animalTypes[breed],
    }))
    .sort((a, b) => b.confidence - a.confidence);
}
