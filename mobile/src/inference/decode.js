/**
 * JPEG -> raw RGBA bytes.
 *
 * ONNX Runtime takes tensors, not images, and React Native has no canvas to
 * decode through. expo-image-manipulator gives us base64 JPEG, so the decode is
 * done in JS.
 *
 * This is the slowest step in the pipeline by a wide margin, which is why the
 * image is cropped to the model's input size *before* decoding — decoding a
 * full-resolution photo would cost several hundred milliseconds and allocate
 * tens of megabytes for pixels we are about to throw away.
 */
import jpeg from 'jpeg-js';
import { toByteArray } from 'base64-js';

/**
 * @param {{base64: string}} image - output of expo-image-manipulator with base64
 * @returns {Uint8Array} RGBA bytes, 4 per pixel
 */
export async function decodePixels(image) {
  if (!image?.base64) {
    throw new Error('Image was not produced with base64 enabled');
  }
  const bytes = toByteArray(image.base64);
  // useTArray keeps the result as a typed array instead of a Node Buffer shim.
  const { data } = jpeg.decode(bytes, { useTArray: true });
  return data;
}
