// Combines InstantDB's auth state with the $users row so callers
// receive a single, fully-typed { user, isLoading, error } shape.
//
// First-time users are signed in but their $users row hasn't been
// populated with displayName/avatarSeed yet — we still return a User
// object (with empty strings for those fields) so screens can route
// to a profile-setup flow rather than treating them as logged out.

import { db } from "../db/client";
import type { User } from "../types";

interface UseCurrentUserResult {
  user: User | null;
  isLoading: boolean;
  error?: Error;
}

export function useCurrentUser(): UseCurrentUserResult {
  const auth = db.useAuth();
  const authUserId = auth.user?.id;

  const profile = db.useQuery(
    authUserId ? { $users: { $: { where: { id: authUserId } } } } : null,
  );

  if (auth.isLoading) {
    return { user: null, isLoading: true };
  }
  if (auth.error) {
    return { user: null, isLoading: false, error: new Error(auth.error.message) };
  }
  if (!auth.user) {
    return { user: null, isLoading: false };
  }

  if (profile.isLoading) {
    return { user: null, isLoading: true };
  }
  if (profile.error) {
    return {
      user: null,
      isLoading: false,
      error: new Error(profile.error.message),
    };
  }

  const row = profile.data?.$users?.[0];
  const user: User = {
    id: auth.user.id,
    email: auth.user.email ?? "",
    displayName: row?.displayName ?? "",
    avatarSeed: row?.avatarSeed ?? "",
  };

  return { user, isLoading: false };
}
