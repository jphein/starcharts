// Live-subscribes to the gifts for a single chart, sorted oldest first
// so star clusters appear in arrival order.
//
// `GiftWithLinks` flattens the InstaQL nested-link rows into the plain
// `Gift` shape with `giver` (single user), `honorees` ($users members),
// and `rosterHonorees` (ad-hoc roster entries) already resolved, so
// screens can render names without re-querying. The two honoree
// surfaces coexist on every gift; either or both may be empty.

import { db } from "../db/client";
import type { Gift, RosterEntry, User } from "../types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string | undefined): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

export type GiftWithLinks = Gift & {
  giver: User | null;
  honorees: User[];
  rosterHonorees: RosterEntry[];
};

interface UseGiftsForChartResult {
  gifts: GiftWithLinks[];
  isLoading: boolean;
}

function toUser(u: {
  id: string;
  email?: string;
  displayName?: string;
  avatarSeed?: string;
}): User {
  return {
    id: u.id,
    email: u.email ?? "",
    displayName: u.displayName ?? "",
    avatarSeed: u.avatarSeed ?? "",
  };
}

function toRosterEntry(r: {
  id: string;
  displayName?: string;
  avatarSeed?: string;
  createdAt?: number;
}): RosterEntry {
  return {
    id: r.id,
    displayName: r.displayName ?? "",
    avatarSeed: r.avatarSeed ?? "",
    createdAt: r.createdAt ?? 0,
  };
}

export function useGiftsForChart(
  chartId: string | undefined,
): UseGiftsForChartResult {
  const valid = isUuid(chartId);

  const result = db.useQuery(
    valid
      ? {
          gifts: {
            $: { where: { "chart.id": chartId } },
            giver: {},
            honorees: {},
            rosterHonorees: {},
          },
        }
      : null,
  );

  if (!valid) {
    return { gifts: [], isLoading: false };
  }
  if (result.isLoading) {
    return { gifts: [], isLoading: true };
  }

  const rows = result.data?.gifts ?? [];
  const gifts: GiftWithLinks[] = rows
    .map((g) => {
      const giverArr = (g as unknown as { giver?: unknown }).giver;
      // InstaQL returns "has: one" links as either a single object or an
      // array depending on shape — normalize to a single user (or null).
      let giver: User | null = null;
      if (Array.isArray(giverArr)) {
        if (giverArr.length > 0) giver = toUser(giverArr[0]);
      } else if (giverArr && typeof giverArr === "object") {
        giver = toUser(giverArr as { id: string });
      }

      const honoreesRaw = (g as unknown as { honorees?: unknown }).honorees;
      const honorees: User[] = Array.isArray(honoreesRaw)
        ? honoreesRaw.map((h) => toUser(h as { id: string }))
        : [];

      const rosterRaw = (g as unknown as { rosterHonorees?: unknown })
        .rosterHonorees;
      const rosterHonorees: RosterEntry[] = Array.isArray(rosterRaw)
        ? rosterRaw.map((r) => toRosterEntry(r as { id: string }))
        : [];

      return {
        id: g.id,
        reason: g.reason,
        count: g.count,
        style: g.style,
        starImageUrl: g.starImageUrl,
        x: g.x,
        y: g.y,
        createdAt: g.createdAt,
        giver,
        honorees,
        rosterHonorees,
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  return { gifts, isLoading: false };
}
