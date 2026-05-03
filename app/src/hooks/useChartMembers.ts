import { db } from "../db/client";
import type { User } from "../types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useChartMembers(chartId: string | undefined) {
  const valid = typeof chartId === "string" && UUID_RE.test(chartId);

  const { data, isLoading } = db.useQuery(
    valid
      ? { charts: { $: { where: { id: chartId } }, members: {} } }
      : null,
  );

  if (!valid) return { members: [], isLoading: false };
  if (isLoading) return { members: [], isLoading: true };

  const row = data?.charts?.[0];
  const members: User[] = (row?.members ?? []).map((m) => ({
    id: m.id,
    email: m.email ?? "",
    displayName: m.displayName ?? "",
    avatarSeed: m.avatarSeed ?? "",
  }));

  return { members, isLoading: false };
}
