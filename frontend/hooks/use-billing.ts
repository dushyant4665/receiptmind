"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, postApiData } from "@/lib/api-client";

export type BillingStatus = {
  plan: "free" | "pro" | "team";
  receipt_count_this_month: number;
  receipt_limit: number;
  can_upload: boolean;
  stripe_customer_id: string;
  has_subscription: boolean;
  upgrade_reason: string;
};

export type BillingPlan = {
  id: "free" | "pro" | "accountant";
  name: string;
  price: number;
  interval: string;
  audience: string;
  quota: number;
  cta: string;
  features: string[];
  positioning: string;
};

const fallbackStatus: BillingStatus = {
  plan: "free",
  receipt_count_this_month: 0,
  receipt_limit: 50,
  can_upload: true,
  stripe_customer_id: "",
  has_subscription: false,
  upgrade_reason: "",
};

export function useBillingStatus() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["billing-status", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      try {
        return await getApiData<BillingStatus>("/billing/status", {
          authToken: session?.accessToken,
        });
      } catch {
        return fallbackStatus;
      }
    },
    placeholderData: fallbackStatus,
  });
}

export function useBillingPlans() {
  return useQuery({
    queryKey: ["billing-plans"],
    staleTime: 60_000,
    queryFn: () => getApiData<BillingPlan[]>("/billing/plans"),
  });
}

export function useCreateCheckout() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (plan: string) => {
      const res = await postApiData<{ url: string }>(
        "/billing/checkout",
        { plan },
        { authToken: session?.accessToken }
      );
      return res;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}
