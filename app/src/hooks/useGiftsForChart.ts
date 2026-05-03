// Live-subscribes to the gifts for a single chart, sorted oldest first
// so star clusters appear in arrival order.
//
// `GiftWithLinks` flattens the InstaQL nested-link rows into the plain
// `Gift` shape with `giver` (single user) and `honorees` (many users)
// already resolved, so screens can render names without re-querying.

import { db } from "../db/client";
import type { Gift, User } from "../types";

export type GiftWithLinks = Gift & {
  giver: User | null;
  honorees: User[];
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

export function useGiftsForChart(
  chartId: string | undefined,
): UseGiftsForChartResult {
  const result = db.useQuery(
    chartId
      ? {
          gifts: {
            $: { where: { "chart.id": chartId } },
            giver: {},
            honorees: {},
          },
        }
      : null,
  );

  if (!chartId) {
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
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  return { gifts, isLoading: false };
}
