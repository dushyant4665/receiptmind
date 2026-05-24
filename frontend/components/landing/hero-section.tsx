import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
];

function Logo({ invert = false }: { invert?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="ReceiptMind home">
      <span
        className={`flex size-8 items-center justify-center rounded-lg text-[12px] font-bold tracking-wider ${
          invert ? "bg-white text-ink" : "bg-ink text-white"
        }`}
      >
        RM
      </span>
      <span
        className={`text-[16px] font-bold tracking-tight ${
          invert ? "text-white" : "text-ink"
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
      <nav className="sticky top-0 z-50 h-16 border-b border-border-subtle bg-white/80 backdrop-blur-md px-6 md:px-10">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          <Logo />

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex text-[13px] font-medium">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild className="text-[13px] font-medium">
              <Link href="/signup">Get started</Link>
            </Button>
            <Button variant="outline" size="icon" className="md:hidden" aria-label="Open navigation">
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
      </nav>

      <section className="bg-bg-page px-6 py-24 text-center md:px-10 md:pb-28 md:pt-32 border-b border-border-subtle">
        <div className="mx-auto max-w-[800px]">
          <div className="inline-flex items-center rounded-full border border-border-default bg-white px-3 py-1 shadow-sm mb-8">
            <div className="flex size-2 items-center justify-center mr-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald opacity-75"></span>
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald"></span>
            </div>
            <span className="text-[12px] font-medium text-text-primary">Gemini AI Engine Live</span>
          </div>

          <h1 className="mx-auto max-w-[700px] text-5xl font-semibold tracking-tight text-text-primary md:text-7xl md:leading-[1.1]">
            Enterprise receipt processing. <span className="text-text-muted">Automated.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[500px] text-[16px] leading-relaxed text-text-secondary md:text-[18px]">
            Stop typing manual expenses. Upload receipts and let our AI extract vendor, amount, date, and category in seconds. Backed by a robust asynchronous queue.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="h-12 px-8 text-[14px] shadow-md w-full sm:w-auto">
              <Link href="/signup">Start uploading now</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="h-12 px-8 text-[14px] bg-white w-full sm:w-auto">
              <Link href="#features" className="inline-flex items-center gap-2">
                See features
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
