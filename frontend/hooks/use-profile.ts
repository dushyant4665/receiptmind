"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, putApiData } from "@/lib/api-client";
import { getDemoProfile, setDemoProfile } from "@/lib/demo-data";
import type { User } from "@/types";

type BackendUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  avatar_url?: string;
  company_name?: string;
};

function mapUser(user: BackendUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    role: user.role ?? "user",
    avatarUrl: user.avatar_url ?? "",
    companyName: user.company_name ?? "",
  };
}

export function useProfile() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      try {
        const user = await getApiData<BackendUser>("/users/me", {
          authToken: session?.accessToken,
        });

        return mapUser(user);
      } catch {
        return getDemoProfile();
      }
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (payload: { name: string; companyName: string; avatarUrl?: string }) => {
      try {
        const user = await putApiData<BackendUser, { name: string; company_name: string; avatar_url: string }>(
          "/users/me",
          {
            name: payload.name,
            company_name: payload.companyName,
            avatar_url: payload.avatarUrl ?? "",
          },
          { authToken: session?.accessToken },
        );

        return mapUser(user);
      } catch {
        const user = {
          ...getDemoProfile(),
          name: payload.name,
          companyName: payload.companyName,
          avatarUrl: payload.avatarUrl ?? "",
        };
        setDemoProfile(user);
        return user;
      }
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["profile", session?.accessToken], user);
    },
  });

  return {
    ...query,
    updateProfile,
  };
}
