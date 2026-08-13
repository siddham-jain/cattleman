/**
 * Stage the files the web build fetches at runtime into public/.
 *
 * Nothing here is committed: the WASM runtimes are copied out of node_modules so
 * package.json stays the single source of truth for their versions, and the ONNX
 * graph is copied from assets/ because a 17 MB import is not something to put
 * through the bundler.
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  ['node_modules/sql.js/dist/sql-wasm.js', 'public/sql/sql-wasm.js'],
  ['node_modules/sql.js/dist/sql-wasm.wasm', 'public/sql/sql-wasm.wasm'],
  // the CPU-only ORT build; the default entry point would pull in a WebGPU
  // binary twice the size for an execution provider this app never asks for
  ['node_modules/onnxruntime-web/dist/ort.wasm.min.js', 'public/ort/ort.wasm.min.js'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'public/ort/ort-wasm-simd-threaded.mjs'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'public/ort/ort-wasm-simd-threaded.wasm'],
  ['assets/model/cattleman.onnx', 'public/model/cattleman.onnx'],
];

for (const [from, to] of FILES) {
  await mkdir(join(root, dirname(to)), { recursive: true });
  await copyFile(join(root, from), join(root, to));
  const { size } = await stat(join(root, to));
  console.log(`staged ${to} (${Math.round(size / 1024)} KB)`);
}
