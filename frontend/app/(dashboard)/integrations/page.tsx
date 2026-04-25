import { Button } from "@/components/ui/button";

const integrations = [
  ["QuickBooks Online", "Connected"],
  ["Xero", "Connect"],
  ["FreshBooks", "Connect"],
  ["Gmail", "Connected"],
  ["Slack", "Connect"],
  ["Zapier", "Connect"],
];

export default function IntegrationsPage() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {integrations.map(([name, status]) => (
        <article key={name} className="rounded-[12px] border border-border-default bg-bg-surface p-5">
          <div className="mb-4 size-8 rounded-[8px] border border-border-default bg-bg-page" />
          <p className="text-[14px] font-medium text-text-primary">{name}</p>
          <p className="mt-1 text-[12px] text-text-muted">Accounting & workflow connector</p>
          <Button variant={status === "Connected" ? "ghost" : "default"} className="mt-4 w-full">
            {status}
          </Button>
        </article>
      ))}
    </div>
  );
}
