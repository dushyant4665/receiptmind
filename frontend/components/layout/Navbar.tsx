"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/changelog", label: "Changelog" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 h-14 border-b border-border-default bg-bg-surface">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="ReceiptMind home">
            <span className="flex size-7 items-center justify-center rounded-[6px] bg-text-primary text-[11px] font-medium tracking-[1px] text-white">
              RM
            </span>
            <span className="text-[15px] font-medium tracking-[-0.3px] text-text-primary">
              ReceiptMind
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[8px] px-3 py-1.5 text-[13px] text-text-secondary transition-[background-color,color] hover:bg-bg-subtle hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="amber">
              <Link href="/signup">Try free</Link>
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={open ? "Close navigation" : "Open navigation"}
            className="md:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </header>

      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-40 bg-black/20 opacity-0 transition-[opacity] md:hidden",
          open && "pointer-events-auto opacity-100",
        )}
        onClick={() => setOpen(false)}
      >
        <div
          className={cn(
            "ml-auto flex h-full w-[288px] translate-x-full flex-col border-l border-border-default bg-bg-surface p-6 transition-[transform]",
            open && "translate-x-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-[6px] bg-text-primary text-[11px] font-medium tracking-[1px] text-white">
                RM
              </span>
              <span className="text-[15px] font-medium tracking-[-0.3px] text-text-primary">
                ReceiptMind
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>
          <nav className="grid gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[8px] px-3 py-2 text-[13px] text-text-secondary transition-[background-color,color] hover:bg-bg-subtle hover:text-text-primary"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 grid gap-2">
            <Button asChild variant="ghost">
              <Link href="/login" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            </Button>
            <Button asChild variant="amber">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Try free
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
