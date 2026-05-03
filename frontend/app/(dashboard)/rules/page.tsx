"use client";

import { useState } from "react";
import { Zap, Plus, Trash2 } from "lucide-react";
import { useRules, useCreateRule } from "@/hooks/use-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const conditionTypes = [
  { value: "vendor", label: "Vendor Name" },
  { value: "category", label: "Category" },
];

const actionTypes = [
  { value: "set_category", label: "Set Category" },
  { value: "ignore", label: "Ignore" },
  { value: "recurring", label: "Mark Recurring" },
];

export default function RulesPage() {
  const { data: rules, isLoading } = useRules();
  const { mutate: createRule, isPending: isCreating } = useCreateRule();
  const [showCreate, setShowCreate] = useState(false);
  const [conditionType, setConditionType] = useState("vendor");
  const [conditionValue, setConditionValue] = useState("");
  const [actionType, setActionType] = useState("set_category");
  const [actionValue, setActionValue] = useState("");

  const handleCreate = () => {
    if (!conditionValue || (!actionValue && actionType === "set_category")) {
      toast.error("Please fill all fields");
      return;
    }
    createRule(
      { conditionType, conditionValue, actionType, actionValue },
      {
        onSuccess: () => {
          setShowCreate(false);
          setConditionValue("");
          setActionValue("");
        },
      },
    );
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Rules</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Automate categorization and processing of receipts
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="size-3.5" />
          New Rule
        </Button>
      </div>

      {/* Auto-learn info banner */}
      <div className="rounded-lg border border-amber-border/40 bg-amber-surface/30 p-4">
        <div className="flex items-start gap-3">
          <Zap className="size-4 text-amber mt-0.5 shrink-0" />
          <div>
            <p className="text-[12px] font-medium text-text-primary">Smart Learning Active</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Rules are auto-created when the same vendor is corrected 3 times. Manual rules always take priority.
            </p>
          </div>
        </div>
      </div>

      {/* Rules list */}
      <section className="rounded-lg border border-border-default bg-white overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-[12px] text-text-muted">Loading rules...</div>
        ) : rules && rules.length > 0 ? (
          <div className="divide-y divide-border-subtle">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 px-4 py-3 hover:bg-bg-page/30 transition-colors">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-surface/60 border border-amber-border/30">
                  <Zap className="size-3.5 text-amber" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-text-primary">
                    When <span className="text-amber">{rule.conditionType}</span> = &quot;{rule.conditionValue}&quot;
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Then <span className="text-amber">{rule.actionType.replace("_", " ")}</span>
                    {rule.actionValue && ` → ${rule.actionValue}`}
                  </p>
                </div>
                <Badge variant={rule.isActive ? "default" : "secondary"}>
                  {rule.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <Zap className="mx-auto size-8 text-text-ghost mb-3" />
            <p className="text-[12px] text-text-muted">No rules yet. Create one to automate your workflow.</p>
          </div>
        )}
      </section>

      {/* Create Rule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-[14px]">Create Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-ghost mb-1.5 block">
                Condition Type
              </label>
              <select
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value)}
                className="h-9 w-full rounded-lg border border-border-default bg-white px-3 text-[12px] outline-none"
              >
                {conditionTypes.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-ghost mb-1.5 block">
                Condition Value
              </label>
              <Input
                placeholder={conditionType === "vendor" ? "e.g. Amazon, Uber" : "e.g. Food, Travel"}
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                className="h-9 text-[12px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-ghost mb-1.5 block">
                Action Type
              </label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="h-9 w-full rounded-lg border border-border-default bg-white px-3 text-[12px] outline-none"
              >
                {actionTypes.map((at) => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
            </div>
            {actionType === "set_category" && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-ghost mb-1.5 block">
                  Category
                </label>
                <Input
                  placeholder="e.g. Shopping, Transport"
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="h-9 text-[12px]"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border-default bg-white px-3 h-8 text-[12px] font-medium hover:bg-bg-subtle">
                Cancel
              </DialogClose>
              <Button size="sm" onClick={handleCreate} disabled={isCreating || !conditionValue}>
                {isCreating ? "Creating..." : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
