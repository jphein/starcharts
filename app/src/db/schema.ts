// InstantDB schema.
// M0: minimal/empty. The full schema (users, groups, charts, gifts +
// links) is fleshed out in M2. See docs/2026-05-02-design-port-plan.md
// §5 for the planned shape.

import { i } from "@instantdb/react";

export const schema = i.schema({
  entities: {},
  links: {},
  rooms: {},
});

export type Schema = typeof schema;
