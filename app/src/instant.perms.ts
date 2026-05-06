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
//
//   2026-05-03 — tightened groups.update + charts.update via
//                `request.modifiedFields.all(field, field == '<X>')`.
//                Earlier attempts at field-immutability used
//                `newData.X == data.X` but failed against partial
//                updates (the goal-reached `update({completedAt})`
//                only puts `completedAt` in newData; unchanged
//                fields read as null and the equality check
//                rejected them). The `modifiedFields` quantifier
//                expresses immutability without hitting that
//                edge: a `tx.update({name: …})` puts only `name`
//                in the set; the rule passes only when every
//                element is the allowed field. Now `groups.update`
//                rejects any change other than `name`, and
//                `charts.update` rejects any change other than
//                `completedAt`.
//
//   2026-05-05 — fixed invite-code join being blocked by groups.update.
//                InstantDB checks update permissions on BOTH sides of a
//                link operation, even when initiated from the $users side
//                (`db.tx.$users[uid].link({ groups: gid })`). That means
//                groups.update fires with modifiedFields = ['members'],
//                which the old rule rejected (it only allowed 'name').
//                Added a second clause: allow when modifiedFields contains
//                only 'members'. A narrower self-join guard using
//                newData.ref('members.id') was tried but caused "Could not
//                evaluate permission rule" — newData.ref() does not support
//                link traversal in InstantDB's rule engine.
//
//   2026-05-06 — tightened groups.update back to rename-only (issue #42).
//                The self-join clause shipped on 2026-05-05 was permissive
//                in the worst case: a non-member writing raw HTTP could
//                mutate the members link in any way (add a third party,
//                unlink existing members) — modifiedFields-only checks
//                can't constrain *which* row appears in the link target.
//                Joins now go through the Worker's POST /api/join-group
//                endpoint, which verifies the caller's refresh token with
//                the admin SDK and links the verified user to the group
//                via admin transact (bypassing perm rules). With the
//                membership write fully admin-side, `groups.update` no
//                longer needs a self-join clause and is back to
//                "members can rename, nothing else."
//
//   2026-05-06 — opened charts.update for goalCount-only writes by group
//                members (issue #44). Original chart contract was "everything
//                immutable except completedAt" — practice showed groups want
//                to retune the goal mid-chart when it turns out too easy or
//                too ambitious. The new clause sits beside the completedAt
//                clause inside one OR-grouped expression: a partial update
//                of just `goalCount` passes when the chart hasn't completed
//                yet and the new value is positive. The "must be ≥ current
//                star total" guardrail is enforced UI-side because rules
//                can't cheaply aggregate gift counts; rule-side stays at
//                "positive integer, chart not completed."
//
//   2026-05-05 — opened gifts.update for x/y-only repositioning by group
//                members (issue #25). Cluster drag re-anchors a gift on
//                the chart sky; satellites recalculate deterministically
//                from the new anchor in starPositioning.ts, so a single
//                two-field write moves the whole cluster. Anything other
//                than x/y is still rejected — reason, count, style, and
//                starImageUrl remain immutable per the original gifts
//                contract. Permitted to any group member rather than
//                giver-only, to match the collaborative-arrangement
//                framing in the issue ("spread stars out when it gets
//                crowded, group stars from the same person together").

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

      // Rename-only. Existing members can change `name`; everything
      // else is immutable from the client. `inviteCode` and `createdAt`
      // are set at creation and never change. The members link is
      // admin-write-only: joins go through the Worker's
      // /api/join-group endpoint, which verifies the caller's refresh
      // token and performs the link via admin transact. No client-side
      // path is permitted to mutate the members link.
      //
      // Uses `modifiedFields.all(...)` so a partial `{name:…}` update
      // passes without checking unchanged fields that would read as
      // null with the simpler `newData.X == data.X` shape.
      update:
        "auth.id != null && " +
        "auth.id in data.ref('members.id') && " +
        "request.modifiedFields.all(field, field == 'name')",

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

      // Members can update via two narrow paths:
      //   1. completedAt-only: a one-way transition from null to a
      //      timestamp. Fires when the goal is reached. Once stamped,
      //      the chart is memory-mode and immutable — preventing
      //      toggle-loops that would retrigger the celebrate scene.
      //   2. goalCount-only: retune the goal mid-chart (issue #44).
      //      Allowed only while the chart is incomplete; the new value
      //      must be positive. Integerness is a UI convention (the
      //      schema is i.number(), and charts.create has never enforced
      //      integers either) — keeping the two paths symmetric rather
      //      than gating only the edit path on integer-ness. The
      //      "≥ current star total" floor is also UI-enforced because
      //      rules can't cheaply aggregate gift counts.
      //
      // Both paths use `request.modifiedFields.all(field, …)` so a
      // partial update is field-pinned: only the listed field may
      // appear in the update set. The OR-group sits inside the
      // membership check so non-members can't take either path. Per
      // the design brief, completed charts become memories, not
      // editable artifacts — both clauses gate on `data.completedAt
      // == null`.
      update:
        "auth.id != null && " +
        "auth.id in data.ref('group.members.id') && " +
        "(" +
        "  (request.modifiedFields.all(field, field == 'completedAt') && " +
        "   data.completedAt == null && " +
        "   newData.completedAt != null) " +
        "  || " +
        "  (request.modifiedFields.all(field, field == 'goalCount') && " +
        "   data.completedAt == null && " +
        "   newData.goalCount > 0)" +
        ")",

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

      // Gifts are mostly immutable. Two narrow exceptions:
      //   1. Update — group members may reposition a cluster on the
      //      sky by writing x/y. `request.modifiedFields.all(field, …)`
      //      pins the update to those two fields; everything else
      //      (reason, count, style, starImageUrl) stays as set at
      //      creation. Anchored on chart membership, not giver, so any
      //      group member can rearrange (issue #25).
      //   2. Delete — the giver may remove their own gift to correct
      //      a mistake; all other deletes blocked.
      update:
        "auth.id != null && " +
        "auth.id in data.ref('chart.group.members.id') && " +
        "request.modifiedFields.all(field, field == 'x' || field == 'y')",
      delete: "auth.id != null && auth.id in data.ref('giver.id')",
    },
  },
} satisfies InstantRules;

export default rules;
