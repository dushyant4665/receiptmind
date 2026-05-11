"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
};

export type OnboardingStatus = {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  forwarding_email: string;
  next_action: {
    label: string;
    href: string;
  };
  magic_moment: boolean;
};

export function useOnboardingStatus() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["onboarding-status", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchInterval: 5000,
    queryFn: () =>
      getApiData<OnboardingStatus>("/onboarding/status", {
        authToken: session?.accessToken,
      }),
  });
}
