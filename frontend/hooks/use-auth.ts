"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";

export function useAuth() {
  const session = useSession();

  return useMemo(
    () => ({
      ...session,
      isAuthenticated: session.status === "authenticated",
      role: (session.data as { user?: { role?: string } } | null)?.user?.role ?? "guest",
    }),
    [session],
  );
}
