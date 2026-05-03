export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarSeed: string;
}

export interface Chart {
  id: string;
  name: string;
  goalCount: number;
  reward: string;
  inviteCode: string;
  ownerId: string;
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
