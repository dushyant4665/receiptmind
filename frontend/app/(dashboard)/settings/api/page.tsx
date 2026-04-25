import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ApiSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-medium text-text-primary">API keys</h2>
            <p className="mt-1 text-[13px] text-text-muted">Generate, rotate, and revoke keys for trusted integrations.</p>
          </div>
          <Button variant="amber">Generate key</Button>
        </div>
        <div className="mt-4 space-y-3">
          {[
            ["ERP sync key", "Last used 2h ago"],
            ["Finance warehouse", "Last used yesterday"],
          ].map(([name, status]) => (
            <div key={name} className="flex items-center justify-between rounded-[8px] border border-border-subtle bg-bg-page px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-text-primary">{name}</p>
                <p className="text-[12px] text-text-muted">{status}</p>
              </div>
              <Button variant="ghost">Revoke</Button>
            </div>
          ))}
        </div>
      </section>
      <p className="text-[13px] text-text-muted">
        Need implementation details?{" "}
        <Link href="/api" className="text-amber transition-[color] hover:text-amber-hover">
          Read the API docs
        </Link>
      </p>
    </div>
  );
}
