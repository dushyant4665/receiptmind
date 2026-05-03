"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, postApiData } from "@/lib/api-client";
import type { Exception } from "@/types";
import { toast } from "sonner";

type BackendException = {
  id: string;
  receipt_id: string;
  organization_id: string;
  type: string;
  field: string;
  message: string;
  status: string;
  created_at: string;
};

function mapException(e: BackendException): Exception {
  return {
    id: e.id,
    receiptId: e.receipt_id,
    organizationId: e.organization_id,
    type: e.type,
    field: e.field,
    message: e.message,
    status: e.status,
    createdAt: e.created_at,
  };
}

export function useExceptions() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["exceptions", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const exceptions = await getApiData<BackendException[]>("/exceptions", {
        authToken: session?.accessToken,
      });
      return exceptions.map(mapException);
    },
  });
}

export function useResolveException() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      return postApiData<Exception>(`/exceptions/${id}/resolve`, { resolution }, {
        authToken: session?.accessToken,
      });
    },
    onSuccess: () => {
      toast.success("Exception resolved");
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: () => {
      toast.error("Failed to resolve exception");
    },
  });
}
