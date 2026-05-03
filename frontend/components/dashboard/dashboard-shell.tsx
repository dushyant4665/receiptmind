"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AlertCircle,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  UploadCloud,
  Layers,
  Sparkles,
  Search,
  ChevronRight,
  Bell,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBillingStatus } from "@/hooks/use-billing";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/exceptions", label: "Exceptions", icon: AlertCircle, badge: 3 },
  { href: "/rules", label: "Rules", icon: Zap },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
];

const categories = [
  { label: "Software", color: "bg-blue-500" },
  { label: "Travel", color: "bg-emerald-500" },
  { label: "Office", color: "bg-amber-500" },
  { label: "Food", color: "bg-rose-500" },
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
  const { data: billing } = useBillingStatus();
  const displayName = session?.user?.name ?? initialUser?.name ?? "User";
  const displayEmail = session?.user?.email ?? initialUser?.email ?? "Enterprise";
  const initials = displayName.slice(0, 2).toUpperCase();

  const usagePercent = billing ? Math.min(Math.round((billing.receipt_count_this_month / billing.receipt_limit) * 100), 100) : 0;

  return (
    <div className="min-h-screen bg-bg-page text-text-primary flex">
      {/* Sidebar */}
      <aside className="hidden w-[260px] flex-col border-r border-border-default bg-white shrink-0 md:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[64px] border-b border-border-subtle">
          <Logo />
        </div>

        {/* AI Badge */}
        <div className="mx-4 mt-5 mb-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-surface/60 border border-amber-border/40">
            <Sparkles className="size-3.5 text-amber fill-amber/20" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber">AI Engine Active</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 mt-3">
          {navigation.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-ink text-white shadow-md shadow-ink/8"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", active ? "text-white" : "text-text-ghost")} strokeWidth={active ? 2 : 1.8} />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-red text-white"
                  )}>
                    {badge}
                  </span>
                )}
                {!active && (
                  <ChevronRight className="size-3.5 text-text-ghost opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Smart Filters */}
        <div className="mt-8 px-3">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-text-ghost">
            Categories
          </p>
          <div className="flex flex-col gap-0.5">
            {categories.map((category) => (
              <div
                key={category.label}
                className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-text-muted cursor-pointer hover:bg-bg-subtle transition-colors"
              >
                <span className={cn("size-1.5 rounded-full", category.color)} />
                {category.label}
              </div>
            ))}
          </div>
        </div>

        {/* Usage */}
        <div className="mt-auto px-3 pb-3">
          <div className="rounded-lg border border-border-default p-3 bg-bg-page/50">
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-text-ghost uppercase tracking-widest">
              <span>Usage</span>
              <span className={cn("font-semibold", usagePercent >= 90 ? "text-red" : "text-amber")}>{usagePercent}%</span>
            </div>
            <div className="h-1 rounded-full bg-border-default overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", usagePercent >= 90 ? "bg-red" : "bg-gradient-to-r from-amber to-amber-hover")} style={{ width: `${usagePercent}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] text-text-ghost">{billing?.receipt_count_this_month ?? 0} / {billing?.receipt_limit ?? 50} this month</p>
          </div>

          {/* User */}
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="group mt-2 flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-all hover:bg-bg-subtle"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-surface text-[11px] font-bold text-amber border border-amber-border/50">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-text-primary">{displayName}</span>
              <span className="block truncate text-[10px] text-text-ghost">{displayEmail}</span>
            </span>
            <LogOut className="size-3.5 text-text-ghost opacity-0 group-hover:opacity-100 group-hover:text-red transition-all" />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-50 h-[64px] border-b border-border-default glass px-6 md:px-8">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="size-5" />
              </Button>
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-border-default bg-white px-3 py-1.5 w-[260px] shadow-xs">
                <Search className="size-4 text-text-ghost" />
                <input
                  placeholder="Search receipts, vendors..."
                  className="bg-transparent border-none outline-none text-[13px] w-full placeholder:text-text-ghost"
                />
                <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border-default bg-bg-page px-1.5 py-0.5 text-[10px] font-mono text-text-ghost">⌘K</kbd>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-9 relative">
                <Bell className="size-4 text-text-muted" />
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red ring-2 ring-white" />
              </Button>

              <Button asChild size="sm" className="h-8 px-3.5 rounded-lg bg-amber hover:bg-amber-hover text-white shadow-xs transition-all hover:shadow-glow hover:-translate-y-px">
                <Link href="/receipts" className="flex items-center gap-1.5">
                  <UploadCloud className="size-3.5" />
                  <span className="text-[12px] font-medium">Upload</span>
                </Link>
              </Button>

              <div className="h-6 w-px bg-border-default mx-1 hidden md:block" />

              <div className="flex size-8 items-center justify-center rounded-full bg-amber-surface text-[11px] font-bold text-amber border border-amber-border/50 cursor-pointer hover:shadow-glow transition-shadow">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto px-6 py-8 md:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
