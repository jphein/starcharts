// InstantDB permission rules.
//
// Source-of-truth is this file; deploy to production with:
//   cd app && npx instant-cli push perms -a <APP_ID>
//
// (or via the InstantDB dashboard's Permissions tab — the JSON
// equivalent of the rules below.)
//
// History:
//   2026-05-07 — added rosterEntries entity + rules. The roster lets a
//                group register ad-hoc honorees (children who don't have
//                accounts) so they can be picked alongside $users members
//                in the gift recipient picker. Rules mirror the
//                groups/charts pattern: members-only view (anchored on the
//                entry's group → members → ids), any authed user may
//                create (the same `newData.ref()` constraint that limits
//                charts/gifts.create applies — read path is members-only,
//                so a misrouted create is invisible), members may update
//                displayName/avatarSeed only (createdAt is immutable; the
//                group link is admin-write-only via the same rationale as
//                groups.update — modifiedFields-only checks can't
//                constrain *which* row a link points at, but in practice
//                members own the rename/recolor surface), and members may
//                delete (unlink-only behavior — InstantDB does not
//                cascade, so existing gifts simply lose their honoree
//                link). The groups.update rename-only invariant from
//                2026-05-06 is preserved exactly.
//
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

      // Members can update active (non-completed) charts in two ways:
      //
      //   1. Complete — stamp completedAt. One-way transition; the chart
      //      must be currently null and the new value must be a real
      //      timestamp. Prevents toggle-loops that retrigger celebrate/memory.
      //
      //   2. Edit goal — change goalCount while the chart is still active.
      //      Validation that the new goal is above the current star count
      //      is enforced client-side (the rule language can't join to gifts).
      //      Completed charts become memories and are no longer editable.
      update:
        "auth.id != null && auth.id in data.ref('group.members.id') && (" +
        "(request.modifiedFields.all(field, field == 'completedAt') && data.completedAt == null && newData.completedAt != null)" +
        " || " +
        "(request.modifiedFields.all(field, field == 'goalCount') && data.completedAt == null)" +
        " || " +
        "(request.modifiedFields.all(field, field == 'name') && data.completedAt == null)" +
        ")",

      // Group members may delete active (non-completed) charts — e.g.
      // to discard one created by mistake. Completed charts are
      // permanent memories and cannot be deleted from the client.
      delete:
        "auth.id != null && auth.id in data.ref('group.members.id') && data.completedAt == null",
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

  reactions: {
    allow: {
      // Visible to members of the reacted gift's chart's group.
      // Path: reaction → gift → chart → group → members → ids.
      view: "auth.id != null && auth.id in data.ref('gift.chart.group.members.id')",

      // Any authed user can create. Same realistic-mitigation pattern as
      // gifts/charts: the view rule above means a reaction written to a
      // gift the creator isn't a member of is invisible to everyone
      // immediately after creation.
      create: "auth.id != null",

      // Only the reactor can remove their own reaction.
      delete: "auth.id != null && auth.id in data.ref('user.id')",

      // Reactions are immutable — toggling is delete + create.
      update: "false",
    },
  },

  rosterEntries: {
    allow: {
      // Members of the entry's group can see it. Path:
      // rosterEntry → its group → that group's members → ids.
      view: "auth.id != null && auth.id in data.ref('group.members.id')",

      // Any authed user can create a rosterEntry row. Same realistic
      // mitigation as groups/charts/gifts.create: InstantDB can't evaluate
      // `newData.ref()` link traversal at create time, but the read path
      // above is members-only, so a misrouted create is invisible to
      // everyone — including the creator — immediately after creation.
      create: "auth.id != null",

      // Members may update displayName/avatarSeed only. createdAt is
      // immutable, and the `group` link is excluded from the allowed
      // field set so a member cannot re-target an existing entry into a
      // different group. Uses `modifiedFields.all(...)` so a partial
      // `{displayName:…}` update passes without the unchanged-fields-as-null
      // edge case that bit groups/charts.update before.
      update:
        "auth.id != null && " +
        "auth.id in data.ref('group.members.id') && " +
        "request.modifiedFields.all(field, field == 'displayName' || field == 'avatarSeed')",

      // Members may delete entries. InstantDB does not cascade — any
      // gifts already linked via giftRosterHonorees simply lose the
      // link, which renders as "for someone" / falls out of the
      // honoree list. This matches the v1 spec: removing a roster
      // entry should not retroactively delete or rewrite gifts.
      delete: "auth.id != null && auth.id in data.ref('group.members.id')",
    },
  },
} satisfies InstantRules;

export default rules;
