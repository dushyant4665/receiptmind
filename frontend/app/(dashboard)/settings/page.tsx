"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";

export default function SettingsPage() {
  const { data, isLoading, updateProfile } = useProfile();
  const [draft, setDraft] = useState<{ name: string; email: string; company: string } | null>(null);

  const formValues = draft ?? {
    name: data?.name ?? "",
    email: data?.email ?? "",
    company: data?.companyName ?? "",
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Workspace settings"
        title="Manage profile details and workspace defaults."
        description="Keep your account details current and make sure finance operations run from the right workspace context."
        align="left"
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
          <h2 className="text-[15px] font-medium text-text-primary">Profile</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="name" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                Name
              </Label>
              <Input
                id="name"
                value={formValues.name}
                onChange={(event) =>
                  setDraft({
                    ...formValues,
                    name: event.target.value,
                  })
                }
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="email" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                Email
              </Label>
              <Input id="email" value={formValues.email} disabled />
            </div>
            <div>
              <Label htmlFor="company" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                Company
              </Label>
              <Input
                id="company"
                value={formValues.company}
                onChange={(event) =>
                  setDraft({
                    ...formValues,
                    company: event.target.value,
                  })
                }
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={async () => {
                try {
                  await updateProfile.mutateAsync({
                    name: formValues.name,
                    companyName: formValues.company,
                  });
                  toast.success("Profile updated.");
                } catch (error) {
                  console.error(error);
                  toast.error("Failed to update profile.");
                }
              }}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </section>

        <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
          <h2 className="text-[15px] font-medium text-text-primary">Workspace links</h2>
          <div className="mt-4 space-y-3">
            {[
              ["/settings/billing", "Billing settings"],
              ["/settings/team", "Team management"],
              ["/settings/api", "API keys"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="block rounded-[8px] border border-border-subtle bg-bg-page px-4 py-3 text-[13px] text-text-secondary transition-[border-color] hover:border-border-strong"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
