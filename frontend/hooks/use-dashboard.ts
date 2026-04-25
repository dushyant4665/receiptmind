"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";
import type { DashboardActivity, DashboardStats } from "@/types";

type BackendDashboardStats = {
  total_spent: number;
  receipt_count: number;
  expense_count: number;
};

type BackendDashboardActivity = {
  id: string;
  type: string;
  label: string;
  created_at: string;
};

function mapDashboardStats(stats: BackendDashboardStats): DashboardStats {
  return {
    totalSpent: Number(stats.total_spent),
    receiptCount: Number(stats.receipt_count),
    expenseCount: Number(stats.expense_count),
  };
}

function mapDashboardActivity(item: BackendDashboardActivity): DashboardActivity {
  return {
    id: item.id,
    type: item.type,
    label: item.label,
    createdAt: item.created_at,
  };
}

export function useDashboardStats() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["dashboard-stats", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      const stats = await getApiData<BackendDashboardStats>("/dashboard/stats", {
        authToken: session?.accessToken,
      });

      return mapDashboardStats(stats);
    },
  });
}

export function useDashboardActivity() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["dashboard-activity", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      const activity = await getApiData<BackendDashboardActivity[]>("/dashboard/activity", {
        authToken: session?.accessToken,
      });

      return activity.map(mapDashboardActivity);
    },
  });
}
