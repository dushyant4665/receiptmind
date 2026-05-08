"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmailInbox } from "@/hooks/use-email-inbox";
import { useIntegrationStatus } from "@/hooks/use-integrations";
import { toast } from "sonner";
import { Copy, Mail, CheckCircle2, FileSpreadsheet, AlertCircle } from "lucide-react";

const integrations = [
  ["QuickBooks Online", "Connect"],
  ["Xero", "Connect"],
  ["FreshBooks", "Connect"],
  ["Gmail", "Connect"],
  ["Slack", "Coming soon"],
  ["Zapier", "Coming soon"],
];

export default function IntegrationsPage() {
  const { data: inbox, isLoading } = useEmailInbox();
  const { data: status, isLoading: isStatusLoading } = useIntegrationStatus();
  const [copied, setCopied] = useState(false);

  const emailAddress = status?.email.address ?? inbox?.email ?? "";

  const handleCopy = async () => {
    if (!emailAddress) return;
    try {
      await navigator.clipboard.writeText(emailAddress);
      setCopied(true);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy email");
    }
  };

  const handleSendTest = () => {
    if (!emailAddress) return;
    const subject = encodeURIComponent("Test receipt from ReceiptMind");
    const body = encodeURIComponent(
      "This is a test email to verify your receipt forwarding is working.\n\nForward receipts here and we'll process them automatically."
    );
    window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Integrations</h1>
        <p className="mt-1 text-[13px] text-text-muted">Connect your tools and automate workflows</p>
      </div>

      {/* Email Inbox Card */}
      <section className="rounded-lg border border-border-default bg-white p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex size-9 items-center justify-center rounded-lg border border-border-default bg-amber-surface">
            <Mail className="size-4 text-amber" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-text-primary">Your receipt email</h2>
            <p className="mt-1 text-[12px] text-text-muted">
              Forward receipts here and we&apos;ll process them automatically.
            </p>

            <div className="mt-3 flex items-center gap-2">
              {isLoading ? (
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-bg-subtle" />
              ) : (
                <Input
                  value={emailAddress}
                  readOnly
                  className="flex-1 font-mono text-[12px] h-8"
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!emailAddress || isLoading}
                className="shrink-0 gap-1.5"
              >
                {copied ? (
                  <CheckCircle2 className="size-3.5 text-emerald" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>

            <div className="mt-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={handleSendTest}
                disabled={!emailAddress || isLoading}
              >
                Send test email
              </Button>
            </div>

            <div className="mt-3 rounded-md border border-border-subtle bg-bg-page px-3 py-2 text-[11px] text-text-muted">
              Email providers should POST attachments to <span className="font-mono text-text-primary">/email/webhook</span> with
              <span className="font-mono text-text-primary"> X-Webhook-Token</span>. Set <span className="font-mono text-text-primary">EMAIL_WEBHOOK_TOKEN</span> in backend env.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border-default bg-white p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex size-9 items-center justify-center rounded-lg border border-border-default bg-emerald-surface">
            <FileSpreadsheet className="size-4 text-emerald" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13px] font-semibold text-text-primary">Google Sheets auto-sync</h2>
              {isStatusLoading ? (
                <span className="h-5 w-20 animate-pulse rounded-full bg-bg-subtle" />
              ) : status?.google_sheets.enabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald">
                  <CheckCircle2 className="size-3" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                  <AlertCircle className="size-3" /> Env needed
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-text-muted">
              Processed receipts append automatically into monthly tabs like March 2026.
            </p>
            <div className="mt-3 grid gap-2 text-[11px] text-text-muted md:grid-cols-3">
              <div className="rounded-md border border-border-subtle bg-bg-page px-3 py-2">
                <span className="block font-mono text-text-primary">GOOGLE_SHEETS_ENABLED=true</span>
              </div>
              <div className="rounded-md border border-border-subtle bg-bg-page px-3 py-2">
                <span className="block font-mono text-text-primary">GOOGLE_SHEETS_SPREADSHEET_ID</span>
              </div>
              <div className="rounded-md border border-border-subtle bg-bg-page px-3 py-2">
                <span className="block font-mono text-text-primary">GOOGLE_SHEETS_ACCESS_TOKEN</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map(([name, status]) => (
          <article key={name} className="rounded-lg border border-border-default bg-white p-4 shadow-xs hover:shadow-sm transition-shadow">
            <div className="mb-3 size-8 rounded-lg border border-border-default bg-bg-page" />
            <p className="text-[12px] font-semibold text-text-primary">{name}</p>
            <p className="mt-0.5 text-[11px] text-text-muted">Accounting & workflow connector</p>
            <Button
              variant={status === "Connect" ? "default" : "ghost"}
              size="xs"
              className="mt-3 w-full"
              disabled={status === "Coming soon"}
            >
              {status}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
