// Tracks the user's currently active group via localStorage so the
// dashboard, header, and chart routes all agree on which group they're
// looking at without prop drilling.
//
// Per the M2 brief the schema supports many-to-many users↔groups but
// the UI is single-group; a group switcher is post-v1. Writers call
// setCurrentGroupId() to store the id and trigger a re-render here.

import { useCallback, useEffect, useState } from "react";
import { db } from "../db/client";
import type { Group, User } from "../types";

const STORAGE_KEY = "starcharts_current_group_id";

interface UseCurrentGroupResult {
  group: Group | null;
  members: User[];
  isLoading: boolean;
  setCurrentGroupId: (id: string | null) => void;
}

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useCurrentGroup(): UseCurrentGroupResult {
  const [groupId, setGroupId] = useState<string | null>(() => readStored());

  // Cross-tab sync — if another tab signs in / switches groups,
  // mirror that here.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setGroupId(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setCurrentGroupId = useCallback((id: string | null) => {
    if (typeof window !== "undefined") {
      try {
        if (id === null) {
          window.localStorage.removeItem(STORAGE_KEY);
        } else {
          window.localStorage.setItem(STORAGE_KEY, id);
        }
      } catch {
        // localStorage may be disabled (private mode quota etc.); state
        // still updates so the in-memory session keeps working.
      }
    }
    setGroupId(id);
  }, []);

  const result = db.useQuery(
    groupId
      ? {
          groups: {
            $: { where: { id: groupId } },
            members: {},
          },
        }
      : null,
  );

  if (!groupId) {
    return { group: null, members: [], isLoading: false, setCurrentGroupId };
  }
  if (result.isLoading) {
    return { group: null, members: [], isLoading: true, setCurrentGroupId };
  }

  const row = result.data?.groups?.[0];
  if (!row) {
    return { group: null, members: [], isLoading: false, setCurrentGroupId };
  }

  const group: Group = {
    id: row.id,
    name: row.name,
    inviteCode: row.inviteCode,
    createdAt: row.createdAt,
  };

  const members: User[] = (row.members ?? []).map((m) => ({
    id: m.id,
    email: m.email ?? "",
    displayName: m.displayName ?? "",
    avatarSeed: m.avatarSeed ?? "",
  }));

  return { group, members, isLoading: false, setCurrentGroupId };
}
