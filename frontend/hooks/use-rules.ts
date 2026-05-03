"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, postApiData } from "@/lib/api-client";
import type { Rule } from "@/types";
import { toast } from "sonner";

type BackendRule = {
  id: string;
  organization_id: string;
  condition_type: string;
  condition_value: string;
  action_type: string;
  action_value: string;
  is_active: boolean;
  created_at: string;
};

function mapRule(r: BackendRule): Rule {
  return {
    id: r.id,
    organizationId: r.organization_id,
    conditionType: r.condition_type,
    conditionValue: r.condition_value,
    actionType: r.action_type,
    actionValue: r.action_value,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

type CreateRuleRequest = {
  conditionType: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
};

export function useRules() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["rules", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const rules = await getApiData<BackendRule[]>("/rules", {
        authToken: session?.accessToken,
      });
      return rules.map(mapRule);
    },
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (rule: CreateRuleRequest) => {
      return postApiData<Rule>("/rules", {
        condition_type: rule.conditionType,
        condition_value: rule.conditionValue,
        action_type: rule.actionType,
        action_value: rule.actionValue,
      }, { authToken: session?.accessToken });
    },
    onSuccess: () => {
      toast.success("Rule created");
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: () => {
      toast.error("Failed to create rule");
    },
  });
}
