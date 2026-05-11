"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";

export type ExportHistoryItem = {
  id: string;
  export_type: string;
  filters: Record<string, string>;
  row_count: number;
  file_name: string;
  created_at: string;
};

export function useExportHistory() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["export-history", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    staleTime: 15_000,
    queryFn: () =>
      getApiData<ExportHistoryItem[]>("/receipts/exports/history", {
        authToken: session?.accessToken,
      }),
  });
}
