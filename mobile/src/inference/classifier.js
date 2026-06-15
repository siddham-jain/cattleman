/**
 * On-device breed classification with ONNX Runtime.
 *
 * Preprocessing here must match ml/data.py's eval transform exactly — resize the
 * short side, centre crop, scale to [0,1], then normalise with ImageNet
 * statistics. A mismatch does not throw; it quietly shifts every prediction, so
 * the constants come from the model's metadata JSON rather than being retyped.
 */
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import modelMetadata from '../../assets/model/cattleman.json';

let sessionPromise = null;

/** Load once and reuse — session creation costs hundreds of milliseconds. */
export function loadModel() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const asset = `${FileSystem.bundleDirectory ?? ''}assets/model/cattleman.onnx`;
      return InferenceSession.create(asset);
    })().catch((error) => {
      // Reset so a later attempt can retry rather than resolving a dead promise.
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

/**
 * Resize + centre crop to the model's input size.
 *
 * expo-image-manipulator has no crop-to-centre primitive, so the short side is
 * resized first and the offsets computed by hand.
 */
async function resizeAndCrop(uri, size) {
  const probe = await ImageManipulator.manipulateAsync(uri, [], {
    base64: false,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const scale = (size * 1.14) / Math.min(probe.width, probe.height);
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(probe.width * scale), height: Math.round(probe.height * scale) } }],
    { format: ImageManipulator.SaveFormat.JPEG },
  );
  const originX = Math.max(0, Math.round((resized.width - size) / 2));
  const originY = Math.max(0, Math.round((resized.height - size) / 2));
  return ImageManipulator.manipulateAsync(
    resized.uri,
    [{ crop: { originX, originY, width: size, height: size } }],
    { base64: true, format: ImageManipulator.SaveFormat.JPEG },
  );
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((value) => Math.exp(value - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((value) => value / sum);
}

/**
 * Build the NCHW float tensor the model expects.
 *
 * `pixels` is RGBA bytes; the alpha channel is dropped and channels are
 * separated, because ONNX wants planar CHW rather than interleaved.
 */
export function buildInputTensor(pixels, size, normalization) {
  const { mean, std } = normalization;
  const data = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      const value = pixels[i * 4 + c] / 255;
      data[c * plane + i] = (value - mean[c]) / std[c];
    }
  }
  return new Tensor('float32', data, [1, 3, size, size]);
}

/**
 * Classify an image and return every breed ranked by probability.
 *
 * Returns the full ranking rather than one answer: with the accuracy this model
 * achieves, a field worker is better served choosing from a shortlist than being
 * told a single breed with false authority.
 */
export async function classify(uri, decodePixels) {
  const session = await loadModel();
  const { img_size: size, classes, normalization, animal_type: animalTypes } = modelMetadata;

  const processed = await resizeAndCrop(uri, size);
  const pixels = await decodePixels(processed);
  const tensor = buildInputTensor(pixels, size, normalization);

  const outputs = await session.run({ input: tensor });
  const logits = Array.from(outputs.logits.data);
  const probabilities = softmax(logits);

  return classes
    .map((breed, index) => ({
      breed,
      confidence: probabilities[index],
      animalType: animalTypes[breed],
    }))
    .sort((a, b) => b.confidence - a.confidence);
}
