"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateCheckout } from "@/hooks/use-billing";
import { Crown, Loader2, X } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { mutate: createCheckout, isPending } = useCreateCheckout();

  const handleUpgrade = () => {
    createCheckout("pro_monthly");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
            <Crown className="size-6 text-amber" />
          </div>
          <DialogTitle className="text-center text-[18px]">
            You&apos;ve reached your free limit
          </DialogTitle>
          <DialogDescription className="text-center text-[14px]">
            Upgrade to Pro for unlimited receipts and premium features.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <div className="rounded-[10px] border border-border-default bg-bg-page p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-text-primary">Pro Monthly</p>
                <p className="text-[13px] text-text-muted">Unlimited receipts</p>
              </div>
              <p className="text-[18px] font-semibold text-text-primary">$19/mo</p>
            </div>
            <ul className="mt-3 space-y-1 text-[12px] text-text-secondary">
              <li>· AI-powered extraction</li>
              <li>· All integrations</li>
              <li>· Priority support</li>
            </ul>
          </div>

          <Button
            variant="amber"
            className="w-full"
            onClick={handleUpgrade}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Upgrade to Pro
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
