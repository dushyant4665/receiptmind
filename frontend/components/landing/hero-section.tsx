import Link from "next/link";
import { ArrowRight, Menu, Clock, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
  { href: "#testimonials", label: "Customers" },
];

function Logo({ invert = false }: { invert?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ReceiptMind home">
      <span
        className={`flex size-7 items-center justify-center rounded-[6px] text-[11px] font-medium tracking-[1px] ${
          invert ? "bg-text-invert text-bg-invert" : "bg-text-primary text-white"
        }`}
      >
        RM
      </span>
      <span
        className={`text-[15px] font-medium tracking-[-0.3px] ${
          invert ? "text-text-invert" : "text-text-primary"
        }`}
      >
        ReceiptMind
      </span>
    </Link>
  );
}

export function HeroSection() {
  return (
    <>
      <nav className="sticky top-0 z-50 h-14 border-b border-border-default bg-bg-surface px-4 md:px-8">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between">
          <Logo />

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
            <Button variant="outline" size="icon" className="md:hidden" aria-label="Open navigation">
              <Menu />
            </Button>
          </div>
        </div>
      </nav>

      <section className="bg-bg-page px-4 py-20 text-center md:px-8 md:pb-20 md:pt-24">
        <div className="mx-auto max-w-[680px]">
          <p className="fade-up inline-flex items-center rounded-[16px] border border-border-default px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Enterprise receipt intelligence
          </p>

          <h1 className="fade-up delay-80 mx-auto mt-6 max-w-[580px] font-heading text-[40px] leading-[1.08] tracking-[-0.5px] text-text-primary md:text-[52px] md:tracking-[-1px]">
            Stop <em className="italic text-amber">typing</em>.
            <br />
            Start uploading.
          </h1>

          <p className="fade-up delay-160 mx-auto mt-4 max-w-[440px] text-[16px] leading-[1.65] text-text-muted">
            Upload receipts, invoices, or PDFs. ReceiptMind extracts vendor, amount, date, category, and tax-ready data before your coffee cools.
          </p>

          <div className="fade-up delay-240 mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button variant="amber" asChild>
              <Link href="/signup">Try free - no card needed</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="#demo" className="inline-flex items-center gap-2">
                See a demo
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <p className="fade-up delay-320 mt-4 text-[12px] text-text-ghost">
            10 receipts free. No credit card. Cancel anytime.
          </p>
        </div>
      </section>
    </>
  );
}
