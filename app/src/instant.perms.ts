// InstantDB permission rules.
//
// Source-of-truth is this file; deploy to production with:
//   cd app && npx instant-cli push perms -a <APP_ID>
//
// (or via the InstantDB dashboard's Permissions tab — the JSON
// equivalent of the rules below.)
//
// History:
//   2026-05-03 — added $users view rule. InstantDB's default for
//                $users hides every row except the authed user's
//                own, which broke `useCurrentGroup`'s members
//                traversal: a 2-member group rendered as 1 because
//                Shawna's $users row was filtered out by the
//                default rule. The new rule allows viewing a
//                $users row when the requester shares at least
//                one group with that user (i.e., they're
//                group-mates).
//
// Future work: groups / charts / gifts currently fall back to
// InstantDB's default (permissive), which is fine for v1 since
// nothing else exposes data across group boundaries. Lock those
// down before any second-tenant scenario.

import type { InstantRules } from "@instantdb/react";

const rules = {
  $users: {
    allow: {
      // - You can always see yourself (so a fresh signup with no
      //   groups can still read displayName/avatarSeed for the
      //   profile-setup flow).
      // - You can see anyone whose `groups` link contains a group
      //   that *also* contains you. `data.ref('groups.members.id')`
      //   flattens to the IDs of every member of every group the
      //   target user belongs to; if our auth.id is in there, the
      //   two of you share at least one group.
      view: "auth.id == data.id || auth.id in data.ref('groups.members.id')",

      // Only the user themselves can update their row.
      // ProfileSetup writes here on behalf of the auth'd user.
      update: "auth.id != null && auth.id == data.id",

      // InstantDB doesn't allow client-side $users deletes
      // regardless of rule (the auth identity is system-managed),
      // and the lint requires this to be the literal string
      // "false". Account removal happens via the InstantDB
      // dashboard.
      delete: "false",
    },
  },
} satisfies InstantRules;

export default rules;
