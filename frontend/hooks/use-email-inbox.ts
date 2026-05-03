"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";

type EmailInboxResponse = {
  email: string;
};

export function useEmailInbox() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["email-inbox", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      const res = await getApiData<EmailInboxResponse>("/email/inbox", {
        authToken: session?.accessToken,
      });
      return res;
    },
  });
}
