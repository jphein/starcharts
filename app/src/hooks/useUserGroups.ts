// Returns all groups the authenticated user belongs to.
// Used by the group switcher on the dashboard so users can move
// between groups without signing out and back in.

import { db } from "../db/client";

export interface GroupSummary {
  id: string;
  name: string;
  inviteCode: string;
}

interface UseUserGroupsResult {
  groups: GroupSummary[];
  isLoading: boolean;
}

export function useUserGroups(userId: string | undefined): UseUserGroupsResult {
  const result = db.useQuery(
    userId
      ? { $users: { $: { where: { id: userId } }, groups: {} } }
      : null,
  );

  if (!userId || result.isLoading) {
    return { groups: [], isLoading: true };
  }

  const userRow = result.data?.$users?.[0];
  const groups: GroupSummary[] = (userRow?.groups ?? []).map((g) => ({
    id: g.id,
    name: g.name ?? "",
    inviteCode: g.inviteCode ?? "",
  }));

  return { groups, isLoading: false };
}
