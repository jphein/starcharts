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
      email:        i.string().indexed(),
      displayName:  i.string(),
      avatarSeed:   i.string(),
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
