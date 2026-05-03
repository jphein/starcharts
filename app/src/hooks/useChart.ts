// Live single-row subscription for one chart by id.
//
// Returns a non-loading empty result when chartId is undefined so callers
// can render the page skeleton without branching on a missing-id state.

import { db } from "../db/client";
import type { Chart } from "../types";

interface UseChartResult {
  chart: Chart | null;
  isLoading: boolean;
}

export function useChart(chartId: string | undefined): UseChartResult {
  const result = db.useQuery(
    chartId
      ? {
          charts: {
            $: { where: { id: chartId } },
          },
        }
      : null,
  );

  if (!chartId) {
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
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  };

  return { chart, isLoading: false };
}
