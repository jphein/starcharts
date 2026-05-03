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
//                one group with that user.
//
//   2026-05-03 — locked down groups / charts / gifts. The URL is
//                now public, and InstantDB's *non*-$users defaults
//                are permissive: any authed visitor with the (also
//                public) app ID could read or write arbitrary
//                charts and gifts in any group. New rules:
//                  - groups: any authed user can create a group;
//                    any member can rename their own group; nobody
//                    can delete via the client. View is open to
//                    any authed user (see "Known gap" below).
//                  - charts: only members of the chart's group can
//                    view, create, or update; charts can't be
//                    deleted from the client (per v1 design —
//                    completed charts become memory).
//                  - gifts: only members of the chart's group can
//                    view or create; gifts are immutable
//                    (update = delete = false).
//
// Known gap: groups.view is intentionally permissive to keep the
// join-by-invite-code flow working. `GroupSetup.handleJoin` does a
// `queryOnce({ groups: { where: { inviteCode } } })` lookup; if the
// view rule were members-only, that query would return empty for a
// non-member and joining would be impossible. The cost: an authed
// visitor can iterate groups and harvest invite codes. The fix is
// a Worker-side `POST /api/join-group` endpoint that does the
// inviteCode lookup with an admin token and returns only the
// groupId, allowing groups.view to be locked to members. Tracked
// as the next perms task.

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

  groups: {
    allow: {
      // See "Known gap" in the file header. Permissive view keeps
      // the invite-code lookup in `GroupSetup.handleJoin` working;
      // gives up enumeration resistance. Replace with members-only
      // once a Worker-side join endpoint exists.
      view: "auth.id != null",

      // Anyone authed can create a group. The same transact links
      // the creator as the first member.
      create: "auth.id != null",

      // Members can rename / edit their group (used by the
      // inline-edit affordance on Dashboard).
      update: "auth.id != null && auth.id in data.ref('members.id')",

      // No client-side group deletion in v1.
      delete: "false",
    },
  },

  charts: {
    allow: {
      // Only members of the chart's group can see it, create it,
      // or update it. `data.ref('group.members.id')` traverses
      // chart → its group → that group's members → their ids;
      // auth.id has to appear in that flat list.
      view: "auth.id != null && auth.id in data.ref('group.members.id')",

      // Same membership check on the proposed row at create time.
      // The link to `group` is set in the same transact, so
      // `newData.ref('group')` resolves to the chart's group.
      create: "auth.id != null && auth.id in newData.ref('group.members.id')",

      // Members can update — used by `chart.completedAt` write
      // when a gift hits the goal.
      update: "auth.id != null && auth.id in data.ref('group.members.id')",

      // Charts are not deletable in v1 — completed charts become
      // memories per the design brief.
      delete: "false",
    },
  },

  gifts: {
    allow: {
      // Visible only to members of the chart's group. Path:
      // gift → chart → group → members → ids.
      view: "auth.id != null && auth.id in data.ref('chart.group.members.id')",

      // Two checks at creation:
      //   - The creator is a member of the gift's chart's group.
      //   - The `giver` link points to the auth user — you can't
      //     post a gift on someone else's behalf.
      create:
        "auth.id != null && " +
        "auth.id in newData.ref('chart.group.members.id') && " +
        "auth.id in newData.ref('giver.id')",

      // Gifts are immutable per design — once a star is sent, it
      // stays. Mistaken sends are corrected by the InstantDB
      // dashboard, not the client.
      update: "false",
      delete: "false",
    },
  },
} satisfies InstantRules;

export default rules;
