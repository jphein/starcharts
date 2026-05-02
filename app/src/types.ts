// Shared row shapes for Starcharts entities.
//
// These mirror schema.ts but flatten the entity rows to plain objects
// (with `id`) so screens and components can take typed props without
// pulling in InstaQL's complex generic helpers.

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarSeed: string;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: number;
}

export interface Chart {
  id: string;
  name: string;
  goalCount: number;
  reward: string;
  createdAt: number;
  completedAt?: number;
}

export interface Gift {
  id: string;
  reason: string;
  count: number;
  style: string;
  starImageUrl: string;
  x: number;
  y: number;
  createdAt: number;
}
