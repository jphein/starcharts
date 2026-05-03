import { i } from "@instantdb/react";

export const schema = i.schema({
  entities: {
    $users: i.entity({
      email:        i.string().indexed(),
      displayName:  i.string(),
      avatarSeed:   i.string(),
    }),
    charts: i.entity({
      name:         i.string(),
      goalCount:    i.number(),
      reward:       i.string(),
      inviteCode:   i.string().unique().indexed(),
      ownerId:      i.string(),
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
    chartMembers: {
      forward: { on: "charts",  has: "many", label: "members"  },
      reverse: { on: "$users",  has: "many", label: "charts"   },
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
