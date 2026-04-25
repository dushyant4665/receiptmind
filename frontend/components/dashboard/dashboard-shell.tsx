"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  UploadCloud,
} from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/reports", label: "Reports", icon: LayoutDashboard },
  { href: "/integrations", label: "Integrations", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const categories = [
  { label: "Software", color: "bg-[var(--cat-software-text)]" },
  { label: "Travel", color: "bg-[var(--cat-travel-text)]" },
  { label: "Office", color: "bg-[var(--cat-office-text)]" },
  { label: "Food", color: "bg-[var(--cat-food-text)]" },
];

type DashboardShellProps = {
  children: ReactNode;
  initialUser?: {
    name?: string | null;
    email?: string | null;
  };
};

export function DashboardShell({ children, initialUser }: DashboardShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const displayName = session?.user?.name ?? initialUser?.name ?? "ReceiptMind User";
  const displayEmail = session?.user?.email ?? initialUser?.email ?? "Signed in";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <header className="sticky top-0 z-50 h-14 border-b border-border-default bg-bg-surface px-4 md:px-8">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          <Logo />
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/receipts">Receipts</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/expenses">Expenses</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/receipts">Upload</Link>
            </Button>
            <div className="flex size-[30px] items-center justify-center rounded-full border-[1.5px] border-amber-border bg-amber-surface text-[12px] font-medium text-amber">
              {initials}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open dashboard menu">
            <Menu />
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="hidden h-[calc(100vh-56px)] overflow-y-auto border-r border-border-default bg-bg-surface px-3 py-5 md:flex md:flex-col">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-text-ghost">
            Workspace
          </p>
          <nav className="grid gap-1">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-[13px] transition-[background-color,color]",
                    active ? "bg-text-primary text-white" : "text-text-secondary hover:bg-bg-subtle",
                  )}
                >
                  <Icon className={cn("size-4", active && "opacity-65")} strokeWidth={1.7} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <p className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-text-ghost">
            Categories
          </p>
          <div className="grid gap-1">
            {categories.map((category) => (
              <div
                key={category.label}
                className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-[13px] text-text-secondary"
              >
                <span className={cn("size-2 rounded-full", category.color)} />
                {category.label}
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-4 pt-6">
            <div>
              <div className="mb-2 flex items-center justify-between text-[12px] text-text-muted">
                <span>Monthly usage</span>
                <span>Live</span>
              </div>
              <div className="h-[3px] rounded-[2px] bg-border-default">
                <div className="h-full w-[68%] rounded-[2px] bg-amber" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2.5 rounded-[8px] border border-border-default p-2.5 text-left transition-[background-color] hover:bg-bg-subtle"
            >
              <span className="flex size-[30px] items-center justify-center rounded-full border border-border-default bg-amber-surface text-[11px] font-medium text-amber">
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-text-primary">
                  {displayName}
                </span>
                <span className="block truncate text-[11px] text-text-ghost">
                  {displayEmail}
                </span>
              </span>
              <LogOut className="size-4 text-text-ghost" />
            </button>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-7 md:px-8">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-text-ghost">
                Overview
              </p>
              <h1 className="mt-1 font-heading text-[26px] leading-[1.2] tracking-[-0.3px] text-text-primary">
                Dashboard
              </h1>
              <p className="mt-1 text-[13px] text-text-muted">
                Keep receipts, approvals, and exports in one calm finance workspace.
              </p>
            </div>
            <Button asChild>
              <Link href="/receipts" className="inline-flex items-center gap-2">
                <UploadCloud />
                Upload receipt
              </Link>
            </Button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
