"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";

export type ProcessingMetrics = {
  average_seconds: number;
  min_seconds: number;
  max_seconds: number;
  count: number;
};

export function useProcessingMetrics() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["processing-metrics", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchInterval: 60_000,
    queryFn: async () => {
      return await getApiData<ProcessingMetrics>("/metrics/processing-times", {
        authToken: session?.accessToken,
      });
    },
  });
}
