import "@testing-library/jest-dom";

// The AI SDK (`ai`) pulls in Web Streams at import time. jsdom does not provide
// `TransformStream`/`ReadableStream`/`WritableStream`, so any jsdom test that
// imports a module touching the SDK (e.g. the RecipeOverview island, which
// imports the shared OVERVIEW_SCHEMA) crashes at load. Polyfill from Node's
// built-in `stream/web` only when absent; node-env suites already have them.
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from "node:stream/web";

// Cast through `unknown`: Node's `stream/web` constructors are structurally
// near-identical to the DOM lib globals but differ in `ArrayBuffer` variance,
// which `tsc --strict` rejects. They are interchangeable at runtime here.
const globals = /** @type {Record<string, unknown>} */ (globalThis);

if (typeof globals.TransformStream === "undefined") {
  globals.TransformStream = TransformStream;
}

if (typeof globals.ReadableStream === "undefined") {
  globals.ReadableStream = ReadableStream;
}

if (typeof globals.WritableStream === "undefined") {
  globals.WritableStream = WritableStream;
}
