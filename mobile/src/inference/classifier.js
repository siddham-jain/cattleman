/**
 * On-device breed classification with ONNX Runtime.
 *
 * The preprocessing constants come from the model's metadata JSON rather than
 * being retyped, and the maths itself lives in preprocess.js so this and the web
 * classifier cannot drift apart.
 */
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import modelMetadata from '../../assets/model/cattleman.json';
import { rankBreeds, RESIZE_RATIO, toPlanarFloat32 } from './preprocess';
import { setModelStatus } from './status';

let sessionPromise = null;

/**
 * Load once and reuse — session creation costs hundreds of milliseconds.
 *
 * There is no download phase here: the graph ships inside the app bundle, which
 * is the point of the whole offline-first design. It still reports its progress
 * so the capture screen can say the same things on a phone as in a browser.
 */
export function loadModel() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      setModelStatus({ phase: 'preparing', progress: 1, error: null });
      const asset = `${FileSystem.bundleDirectory ?? ''}assets/model/cattleman.onnx`;
      const session = await InferenceSession.create(asset);
      setModelStatus({ phase: 'ready', progress: 1 });
      return session;
    })().catch((error) => {
      // Reset so a later attempt can retry rather than resolving a dead promise.
      sessionPromise = null;
      setModelStatus({ phase: 'error', error: error?.message ?? String(error) });
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
  const scale = (size * RESIZE_RATIO) / Math.min(probe.width, probe.height);
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

/** Classify an image and return every breed ranked by probability. */
export async function classify(uri, decodePixels) {
  const session = await loadModel();
  const { img_size: size, normalization } = modelMetadata;

  const processed = await resizeAndCrop(uri, size);
  const pixels = await decodePixels(processed);
  const data = toPlanarFloat32(pixels, size, normalization);

  const outputs = await session.run({ input: new Tensor('float32', data, [1, 3, size, size]) });
  return rankBreeds(Array.from(outputs.logits.data), modelMetadata);
}
