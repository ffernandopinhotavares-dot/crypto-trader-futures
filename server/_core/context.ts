import { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export interface Context {
  user?: {
    id: string;
    email?: string;
  };
}

export function createContext(opts: CreateExpressContextOptions): Context {
  // In a real app, you'd extract user info from JWT or session
  return {
    user: {
      id: "local-owner",
    },
  };
}
