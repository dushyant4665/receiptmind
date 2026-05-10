"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, postApiData } from "@/lib/api-client";

type IntegrationStatus = {
  email: {
    enabled: boolean;
    address: string;
    webhook_route: string;
  };
  google_sheets: {
    enabled: boolean;
    connected: boolean;
    spreadsheet_id: string;
    spreadsheet_id_set: boolean;
    last_sync_at?: string | null;
    last_error?: string;
    oauth_configured: boolean;
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

export function useConnectGoogleSheets() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: () =>
      getApiData<{ url: string }>("/integrations/google/connect", {
        authToken: session?.accessToken,
      }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}

export function useDisconnectGoogleSheets() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      postApiData<{ disconnected: boolean }>("/integrations/google/disconnect", undefined, {
        authToken: session?.accessToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations-status"] });
    },
  });
}
