// Re-exports the canonical schema for the `instant-cli push schema`
// command, which by default looks for `instant.schema.ts` at the
// project root and (in 1.0.x) trips on a CJS/ESM interop quirk when
// loading a named-export-only TS module deep in the tree.
//
// The canonical schema lives at src/db/schema.ts so it stays
// co-located with the rest of the db/ wiring; this file is just the
// entry point the CLI expects.
export { schema as default, schema } from "./src/db/schema";
