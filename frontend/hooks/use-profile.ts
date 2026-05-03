"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, putApiData } from "@/lib/api-client";
import type { User } from "@/types";

type BackendUser = {
  id: string;
  email: string;
  name?: string;
};

function mapUser(user: BackendUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    role: "user",
    avatarUrl: "",
    companyName: "",
  };
}

export function useProfile() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      const user = await getApiData<BackendUser>("/users/me", {
        authToken: session?.accessToken,
      });

      return mapUser(user);
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const user = await putApiData<BackendUser, { name: string }>(
        "/users/me",
        { name: payload.name },
        { authToken: session?.accessToken },
      );
      return mapUser(user);
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
