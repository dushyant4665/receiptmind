"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";

export type OpsHealth = {
  queue_depth: number;
  dead_letter_depth: number;
  jobs_processing: number;
  jobs_failed_24h: number;
  avg_processing_seconds: number;
  checked_at: string;
};

export function useOpsHealth() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["ops-health", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchInterval: 5000,
    queryFn: () =>
      getApiData<OpsHealth>("/ops/health", {
        authToken: session?.accessToken,
      }),
  });
}
