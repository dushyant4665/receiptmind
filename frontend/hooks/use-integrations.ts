"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";

type IntegrationStatus = {
  email: {
    enabled: boolean;
    address: string;
    webhook_route: string;
  };
  google_sheets: {
    enabled: boolean;
    spreadsheet_id_set: boolean;
  };
};

export function useIntegrationStatus() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["integrations-status", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchInterval: 30_000,
    queryFn: () =>
      getApiData<IntegrationStatus>("/integrations/status", {
        authToken: session?.accessToken,
      }),
  });
}
