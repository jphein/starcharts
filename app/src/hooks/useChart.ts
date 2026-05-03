// Live single-row subscription for one chart by id.
//
// Returns a non-loading empty result when chartId is undefined so callers
// can render the page skeleton without branching on a missing-id state.
// Invalid UUIDs are treated the same as "chart not found" — the chart-gate
// effect in each consumer redirects to /dashboard.

import { db } from "../db/client";
import type { Chart } from "../types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string | undefined): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

interface UseChartResult {
  chart: Chart | null;
  isLoading: boolean;
}

export function useChart(chartId: string | undefined): UseChartResult {
  const valid = isUuid(chartId);

  const result = db.useQuery(
    valid
      ? {
          charts: {
            $: { where: { id: chartId } },
          },
        }
      : null,
  );

  if (!valid) {
    return { chart: null, isLoading: false };
  }
  if (result.isLoading) {
    return { chart: null, isLoading: true };
  }

  const row = result.data?.charts?.[0];
  if (!row) {
    return { chart: null, isLoading: false };
  }

  const chart: Chart = {
    id: row.id,
    name: row.name,
    goalCount: row.goalCount,
    reward: row.reward,
    inviteCode: row.inviteCode ?? "",
    ownerId: row.ownerId ?? "",
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  };

  return { chart, isLoading: false };
}
