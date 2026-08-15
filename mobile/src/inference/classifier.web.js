/**
 * Breed classification in a browser (web only).
 *
 * Same model, same preprocessing, same ranking as the phone — the only things
 * that change are how the pixels are obtained and which ONNX Runtime build runs
 * the graph. onnxruntime-react-native is a native module and cannot load here.
 *
 * The runtime is fetched by <script> rather than imported, for the same reason
 * sql.js is: its loader uses a dynamic import that Metro refuses to bundle. The
 * files are copied out of node_modules by scripts/web-assets.mjs, so the version
 * in package.json is still the only place it is pinned.
 *
 * The graph and the WASM runtime come to roughly 30 MB together, fetched in the
 * background at startup so the rest of the app is usable immediately and the
 * browser caches it for every run after. Measured cold: 0.6 s on localhost, 31 s
 * on 4G, 175 s on 3G. The graph is streamed rather than handed to ONNX Runtime
 * as a URL, because a byte count is the only way to tell the worker how far
 * along that download actually is.
 */
import modelMetadata from '../../assets/model/cattleman.json';
import { rankBreeds, RESIZE_RATIO, toPlanarFloat32 } from './preprocess';
import { setModelStatus } from './status';

const ORT_DIR = '/ort/';
const MODEL_URL = '/model/cattleman.onnx';

// The dev server sends the graph brotli-compressed and chunked, so there is no
// Content-Length for JS to read. The decoded size is known from the metadata
// (size_mb is bytes/1e6), and decoded bytes are what the reader counts, so it
// stands in. Being rounded up by a fraction of a percent, it never reads 100%
// before the last chunk lands.
const EXPECTED_BYTES = Math.round(modelMetadata.size_mb * 1e6);

let runtimePromise = null;
let sessionPromise = null;

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = new Promise((resolve, reject) => {
      if (window.ort) {
        resolve(window.ort);
        return;
      }
      setModelStatus({ phase: 'runtime', progress: 0, error: null });
      const script = document.createElement('script');
      script.src = `${ORT_DIR}ort.wasm.min.js`;
      script.onload = () => resolve(window.ort);
      script.onerror = () => reject(new Error(
        'ONNX Runtime failed to load. Run `npm run web:assets` to populate mobile/public.',
      ));
      document.head.appendChild(script);
    }).then((ort) => {
      ort.env.wasm.wasmPaths = ORT_DIR;
      // Multi-threading needs cross-origin isolation, which the dev server does
      // not send. Asking for threads without it fails the whole session.
      ort.env.wasm.numThreads = 1;
      return ort;
    }).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

/**
 * Fetch the graph, reporting progress as it arrives.
 *
 * The reader counts decoded bytes, so the percentage is against the graph's
 * real size whether or not the server compressed it in transit.
 */
async function fetchModel() {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`${MODEL_URL} returned ${response.status}. Run \`npm run web:assets\`.`);
  }

  const total = Number(response.headers.get('content-length')) || EXPECTED_BYTES;
  setModelStatus({ phase: 'downloading', progress: 0, received: 0, total });

  if (!response.body?.getReader) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    setModelStatus({
      phase: 'downloading',
      progress: Math.min(1, received / total),
      received,
      total,
    });
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function loadModel() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await loadRuntime();
      const bytes = await fetchModel();
      // Building the graph blocks the main thread for a moment, so say so
      // rather than letting a full progress bar sit there looking stuck.
      setModelStatus({ phase: 'preparing', progress: 1 });
      const session = await ort.InferenceSession.create(bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      setModelStatus({ phase: 'ready', progress: 1 });
      return session;
    })().catch((error) => {
      // Reset so a later attempt can retry rather than resolving a dead promise.
      sessionPromise = null;
      setModelStatus({ phase: 'error', error: error.message });
      throw error;
    });
  }
  return sessionPromise;
}

/**
 * Resize the short side, centre crop, and read back RGBA bytes.
 *
 * A canvas does the resize and the crop in one drawImage, which is both faster
 * and closer to the training transform than doing it in two passes.
 */
async function decodeToPixels(uri, size) {
  const image = await loadImage(uri);
  const scale = (size * RESIZE_RATIO) / Math.min(image.width, image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return context.getImageData(0, 0, size, size).data;
}

function loadImage(uri) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected image could not be read.'));
    image.src = uri;
  });
}

export async function classify(uri) {
  const [ort, session] = await Promise.all([loadRuntime(), loadModel()]);
  const { img_size: size, normalization } = modelMetadata;

  const pixels = await decodeToPixels(uri, size);
  const data = toPlanarFloat32(pixels, size, normalization);

  const outputs = await session.run({
    input: new ort.Tensor('float32', data, [1, 3, size, size]),
  });
  return rankBreeds(Array.from(outputs.logits.data), modelMetadata);
}
