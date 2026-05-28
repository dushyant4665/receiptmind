import Link from "next/link";
import { ArrowRight, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
];

export function HeroSection() {
  return (
    <>
      <nav className="sticky top-0 z-50 h-14 border-b border-border-default bg-bg-surface px-4 md:px-8">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between">
          <Link href="/" aria-label="ReceiptMind home">
            <Logo />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[8px] px-3 py-1.5 text-[13px] text-text-secondary transition-[background-color,color] hover:bg-bg-subtle hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden md:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Try free</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="bg-bg-page px-4 py-16 md:px-8 md:pb-18 md:pt-22">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="text-center lg:text-left">
            <p className="fade-up inline-flex items-center rounded-[16px] border border-border-default px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Receipt workflow
            </p>

            <h1 className="fade-up delay-80 mt-6 max-w-[620px] font-heading text-[40px] leading-[1.08] tracking-[-0.5px] text-text-primary md:text-[56px] md:tracking-[-1px]">
              Turn receipts into review-ready expense data.
            </h1>

            <p className="fade-up delay-160 mx-auto mt-4 max-w-[500px] text-[16px] leading-[1.65] text-text-muted lg:mx-0">
              Upload receipts, extract clean fields, fix exceptions, apply rules, and export CSVs without spreadsheet cleanup.
            </p>

            <div className="fade-up delay-240 mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row lg:justify-start">
              <Button variant="amber" asChild>
                <Link href="/signup">Start processing</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="#workflow" className="inline-flex items-center gap-2">
                  View workflow
                  <ArrowRight />
                </Link>
              </Button>
            </div>

            <div className="fade-up delay-320 mt-6 grid gap-2 text-[12px] text-text-muted sm:grid-cols-3">
              {[
                { icon: FileCheck2, label: "CSV exports" },
                { icon: Sparkles, label: "AI extraction" },
                { icon: ShieldCheck, label: "Review controls" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-2 lg:justify-start"
                >
                  <item.icon className="size-3.5 text-amber" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="fade-up delay-160 rounded-[16px] border border-border-default bg-bg-surface p-3 shadow-lg">
            <div className="rounded-[12px] border border-border-subtle bg-bg-page p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium text-text-primary">Processing summary</p>
                  <p className="text-[11px] text-text-ghost">Receipts ready for review</p>
                </div>
                <span className="rounded-full bg-success-surface px-2.5 py-1 text-[11px] font-medium text-success">
                  Ready
                </span>
              </div>
              <div className="space-y-2">
                {[
                  ["Adobe", "$54.99", "Software", "98%"],
                  ["Uber", "$18.42", "Travel", "94%"],
                  ["Staples", "$126.18", "Office", "91%"],
                ].map(([vendor, amount, category, confidence]) => (
                  <div key={vendor} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border-default bg-white p-3">
                    <div>
                      <p className="text-[13px] font-medium text-text-primary">{vendor}</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{category} category</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold text-text-primary">{amount}</p>
                      <p className="mt-0.5 text-[11px] text-success">{confidence}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-amber-border bg-amber-surface p-3">
                <p className="text-[12px] font-medium text-amber">Needs review</p>
                <p className="mt-1 text-[12px] leading-[1.5] text-text-secondary">
                  One receipt has low date confidence. Fix it before export.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
