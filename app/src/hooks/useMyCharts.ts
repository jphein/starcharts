import { db } from "../db/client";
import type { Chart } from "../types";

export function useMyCharts(userId: string | undefined) {
  const { data, isLoading } = db.useQuery(
    userId
      ? { charts: { $: { where: { "members.id": userId } } } }
      : null,
  );

  const charts: Chart[] = (data?.charts ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      goalCount: row.goalCount,
      reward: row.reward,
      inviteCode: row.inviteCode ?? "",
      ownerId: row.ownerId ?? "",
      createdAt: row.createdAt,
      completedAt: row.completedAt ?? undefined,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return { charts, isLoading };
}
