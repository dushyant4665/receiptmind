"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";

export default function SettingsPage() {
  const { data, isLoading, updateProfile } = useProfile();
  const [draftName, setDraftName] = useState<string | null>(null);

  const name = draftName ?? (data?.name ?? "");

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({ name });
      toast.success("Profile updated.");
    } catch {
      toast.error("Failed to update profile.");
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-text-muted">Manage your profile and workspace</p>
      </div>

      <div className="grid gap-6">
        <section className="rounded-lg border border-border-default bg-white p-5 shadow-xs max-w-2xl">
          <h2 className="text-[13px] font-semibold text-text-primary">Profile</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="name" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setDraftName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="email" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                Email
              </Label>
              <Input id="email" value={data?.email ?? ""} disabled className="bg-bg-page" />
            </div>
            <Button
              onClick={handleSave}
              disabled={updateProfile.isPending || isLoading}
              size="sm"
            >
              {updateProfile.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
