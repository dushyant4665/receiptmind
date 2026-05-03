"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";
import type { DashboardStats } from "@/types";

type BackendDashboardStats = {
  total_receipts: number;
  total_amount: number;
  processed_count: number;
  pending_count: number;
  needs_review_count: number;
};

function mapDashboardStats(stats: BackendDashboardStats): DashboardStats {
  return {
    totalReceipts: Number(stats.total_receipts),
    totalAmount: Number(stats.total_amount),
    processedCount: Number(stats.processed_count),
    pendingCount: Number(stats.pending_count),
    needsReviewCount: Number(stats.needs_review_count),
  };
}

export function useDashboardStats() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["dashboard-stats", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const stats = await getApiData<BackendDashboardStats>("/dashboard", {
        authToken: session?.accessToken,
      });

      return mapDashboardStats(stats);
    },
  });
}
