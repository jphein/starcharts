// Live-subscribes to the charts for a single group, sorted newest first.
//
// Used by the dashboard tile list. Returns an empty (non-loading) result
// when groupId is falsy so callers can render the page skeleton without
// branching on a separate "no group selected" state.

import { db } from "../db/client";
import type { Chart } from "../types";

interface UseChartsForGroupResult {
  charts: Chart[];
  isLoading: boolean;
}

export function useChartsForGroup(
  groupId: string | null | undefined,
): UseChartsForGroupResult {
  const result = db.useQuery(
    groupId
      ? {
          charts: {
            $: { where: { "group.id": groupId } },
          },
        }
      : null,
  );

  if (!groupId) {
    return { charts: [], isLoading: false };
  }
  if (result.isLoading) {
    return { charts: [], isLoading: true };
  }

  // Sort client-side: schema's `createdAt` is a plain number (not indexed),
  // so InstantDB won't accept it as a server-side `order` key. The list is
  // bounded (one group's charts) so a JS sort is fine.
  const charts: Chart[] = (result.data?.charts ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      goalCount: c.goalCount,
      reward: c.reward,
      createdAt: c.createdAt,
      completedAt: c.completedAt ?? undefined,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return { charts, isLoading: false };
}
