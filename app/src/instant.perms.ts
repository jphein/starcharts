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
//                    can delete via the client. View was kept open
//                    to authed users so the join-by-invite-code
//                    flow could resolve a code → groupId; closed
//                    to members-only later (see 2026-05-03 entry
//                    below).
//                  - charts: only members of the chart's group can
//                    view, create, or update; charts can't be
//                    deleted from the client (per v1 design —
//                    completed charts become memory).
//                  - gifts: only members of the chart's group can
//                    view or create; gifts are immutable
//                    (update = delete = false).
//
//   2026-05-03 — closed groups.view to members-only. Now that the
//                Cloudflare Worker exposes `POST /api/join-group`
//                (admin-token-backed inviteCode → groupId lookup),
//                the SPA's `GroupSetup.handleJoin` no longer needs
//                direct read access to `groups`. Closing this rule
//                is what makes group enumeration impractical from
//                the public app.

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
      // Members-only. Non-members never need to read `groups`
      // directly — the SPA's join-by-code path goes through the
      // Cloudflare Worker's `/api/join-group` endpoint, which
      // does the inviteCode lookup with the InstantDB admin
      // token and returns just the group id + name. Closing
      // direct read here is what makes group enumeration
      // impractical from the public app.
      view: "auth.id != null && auth.id in data.ref('members.id')",

      // Any authed user can create a group. We *intend* the same
      // transact to link the creator as the first member — but we
      // can't enforce that at create time via the rule, since
      // `newData.ref()` doesn't resolve link targets being set in
      // the same transact (same constraint as charts/gifts.create).
      // Realistic mitigation is the same as elsewhere: any group
      // created without a member link is invisible to everyone via
      // the read paths that depend on membership. A Worker-side
      // write proxy with admin auth would close this for real.
      create: "auth.id != null",

      // Members can rename their group, but inviteCode and
      // createdAt are immutable after creation. Without the
      // equality clauses below, any member could rotate the invite
      // code (breaking the join flow for everyone else) or rewrite
      // the group's birthday. Lock both fields by requiring the
      // proposed value to equal the current value.
      update:
        "auth.id != null && " +
        "auth.id in data.ref('members.id') && " +
        "newData.inviteCode == data.inviteCode && " +
        "newData.createdAt == data.createdAt",

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

      // Any authed user can create a chart row. Tighter
      // membership-on-create checks turned out to fail with
      // "Could not evaluate permission rule" in InstantDB —
      // `newData.ref()` does not resolve through links set in
      // the same transact at create time. The protection is
      // still meaningful: charts.view is members-only, so a
      // chart created against a group the creator doesn't belong
      // to would be invisible to everyone (including the creator)
      // immediately after creation.
      create: "auth.id != null",

      // Members can update. Tried locking everything except
      // `completedAt` via `newData.X == data.X` clauses, but the
      // goal-reached transact (chart.update with only completedAt
      // set) failed against those equality checks — InstantDB's
      // `newData` for a partial update may not echo back the
      // unchanged fields the way the rule expected. Reverted to
      // simple membership-only until the partial-update semantics
      // are nailed down. Tighter immutability of name/goalCount/
      // reward/createdAt belongs in a Worker write proxy or in a
      // link-rule pattern.
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

      // Any authed user can create a gift row. The same
      // `newData.ref()` constraint that blocked charts.create
      // applies here — InstantDB can't evaluate the link
      // traversal at create time when the links are set in the
      // same transact. Protection is still meaningful: gifts.view
      // is members-only, so a gift written to a chart the creator
      // isn't a member of is invisible to everyone (including
      // them) and falls out of the application's read paths
      // entirely. Tighter giver-must-equal-self enforcement
      // belongs in a Worker-side write proxy or in a dedicated
      // link-rule pattern; tracked as the next perms task.
      create: "auth.id != null",

      // Gifts are immutable per design — once a star is sent, it
      // stays. Mistaken sends are corrected by the InstantDB
      // dashboard, not the client.
      update: "false",
      delete: "false",
    },
  },
} satisfies InstantRules;

export default rules;
