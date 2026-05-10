"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";

export type AccountantClient = {
  id: string;
  name: string;
  slug: string;
  processing_count: number;
  open_exceptions: number;
  processed_amount: number;
};

export type AccountantReviewItem = {
  id: string;
  receipt_id: string;
  organization_id: string;
  organization_name: string;
  type: string;
  field: string;
  message: string;
  created_at: string;
};

export function useAccountantClients() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["accountant-clients", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    staleTime: 15_000,
    queryFn: () =>
      getApiData<AccountantClient[]>("/accountant/clients", {
        authToken: session?.accessToken,
      }),
  });
}

export function useAccountantReviewQueue() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["accountant-review-queue", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchInterval: 5000,
    queryFn: () =>
      getApiData<AccountantReviewItem[]>("/accountant/review-queue", {
        authToken: session?.accessToken,
      }),
  });
}
