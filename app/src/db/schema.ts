// InstantDB schema for Starcharts.
// See docs/2026-05-02-design-port-plan.md §5.
//
// Conventions:
// - timestamps are epoch-ms numbers (i.number())
// - x, y on gifts are normalized 0..1 floats so positions render
//   correctly across viewport sizes
// - inviteCode is unique + indexed so we can resolve "join by code"

import { i } from "@instantdb/react";

export const schema = i.schema({
  entities: {
    $users: i.entity({
      // The $users namespace is system-managed (auth identity rows are
      // created by InstantDB itself), so its attributes must be declared
      // optional — InstantDB's `push schema` rejects required fields on
      // $users even when our application code always populates them.
      // email is set the moment a user authenticates with a magic code;
      // displayName / avatarSeed are populated by ProfileSetup right
      // after first sign-in. Code paths reading these fields already
      // tolerate "" / undefined gracefully.
      email:        i.string().indexed().optional(),
      displayName:  i.string().optional(),
      avatarSeed:   i.string().optional(),
    }),
    groups: i.entity({
      name:         i.string(),
      inviteCode:   i.string().unique().indexed(),
      createdAt:    i.number(),
    }),
    charts: i.entity({
      name:         i.string(),
      goalCount:    i.number(),
      reward:       i.string(),
      createdAt:    i.number(),
      completedAt:  i.number().optional(),
    }),
    gifts: i.entity({
      reason:        i.string(),
      count:         i.number(),
      style:         i.string(),
      starImageUrl:  i.string(),
      x:             i.number(),
      y:             i.number(),
      createdAt:     i.number(),
    }),
    // Ad-hoc honorees (kids without accounts). Group-shared: every member
    // sees the same roster. Selectable in the gift picker alongside $users
    // members. Unlinked-only delete — removing a roster entry doesn't
    // cascade to gifts already attached, those just lose the link.
    rosterEntries: i.entity({
      displayName: i.string(),
      avatarSeed:  i.string(),
      createdAt:   i.number(),
    }),
    // Heart reactions on gifts. One row per (user, gift) pair — enforced
    // client-side by checking for an existing reaction before creating.
    // emoji is always "heart" for now; the field leaves room for other
    // reaction types later without a schema migration.
    reactions: i.entity({
      emoji:     i.string(),
      createdAt: i.number(),
    }),
  },
  links: {
    groupMembers: {
      forward: { on: "groups",  has: "many", label: "members"  },
      reverse: { on: "$users",  has: "many", label: "groups"   },
    },
    chartGroup: {
      forward: { on: "charts",  has: "one",  label: "group"    },
      reverse: { on: "groups",  has: "many", label: "charts"   },
    },
    giftChart: {
      forward: { on: "gifts",   has: "one",  label: "chart"    },
      reverse: { on: "charts",  has: "many", label: "gifts"    },
    },
    giftGiver: {
      forward: { on: "gifts",   has: "one",  label: "giver"    },
      reverse: { on: "$users",  has: "many", label: "given"    },
    },
    giftHonorees: {
      forward: { on: "gifts",   has: "many", label: "honorees" },
      reverse: { on: "$users",  has: "many", label: "received" },
    },
    rosterEntryGroup: {
      forward: { on: "rosterEntries", has: "one",  label: "group"         },
      reverse: { on: "groups",        has: "many", label: "rosterEntries" },
    },
    giftRosterHonorees: {
      forward: { on: "gifts",         has: "many", label: "rosterHonorees" },
      reverse: { on: "rosterEntries", has: "many", label: "received"       },
    },
    reactionGift: {
      forward: { on: "reactions", has: "one",  label: "gift"      },
      reverse: { on: "gifts",     has: "many", label: "reactions" },
    },
    reactionUser: {
      forward: { on: "reactions", has: "one",  label: "user"      },
      reverse: { on: "$users",    has: "many", label: "reactions" },
    },
  },
  rooms: {
    charts: {
      presence: i.entity({
        displayName: i.string(),
        avatarSeed:  i.string(),
      }),
    },
  },
});

export type Schema = typeof schema;
