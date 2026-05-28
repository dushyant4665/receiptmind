"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AlertCircle,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  UploadCloud,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/exceptions", label: "Exceptions", icon: AlertCircle, badge: 3 },
  { href: "/rules", label: "Rules", icon: Zap },
  { href: "/settings", label: "Settings", icon: Settings },
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
  const { data: profile } = useProfile();
  const displayName = profile?.name || session?.user?.name || initialUser?.name || "User";
  const displayEmail = profile?.email || session?.user?.email || initialUser?.email || "Enterprise";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-bg-page text-text-primary">
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-border-default bg-white md:flex">
        <div className="flex h-[64px] items-center border-b border-border-subtle px-5">
          <Logo />
        </div>

        <div className="mx-4 mb-1 mt-5">
          <div className="flex items-center gap-2 rounded-lg bg-bg-subtle/70 px-3 py-2 text-[11px] font-medium text-text-muted">
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-20" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald" />
            </span>
            Processing ready
          </div>
        </div>

        <nav className="mt-3 flex flex-col gap-0.5 px-3">
          {navigation.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                  active
                    ? "bg-ink text-white shadow-md shadow-ink/8"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
                )}
              >
                <Icon
                  className={cn("size-[18px] shrink-0", active ? "text-white" : "text-text-ghost")}
                  strokeWidth={active ? 2 : 1.8}
                />
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                      active ? "bg-white/20 text-white" : "bg-red text-white",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
                {!active ? (
                  <ChevronRight className="size-3.5 text-text-ghost opacity-0 transition-opacity group-hover:opacity-100" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-3 pb-3">
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="group mt-2 flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-bg-subtle"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-amber-border/50 bg-amber-surface text-[11px] font-bold text-amber">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-text-primary">{displayName}</span>
              <span className="block truncate text-[10px] text-text-ghost">{displayEmail}</span>
            </span>
            <LogOut className="size-3.5 text-text-ghost opacity-0 transition-opacity group-hover:text-red group-hover:opacity-100" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 h-[64px] border-b border-border-default px-4 glass md:px-8">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="md:hidden">
                <Logo />
              </div>
              <p className="hidden text-[13px] text-text-muted md:block">
                Review uploads, exceptions, rules, and exports from one workspace.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                className="h-8 rounded-lg bg-amber px-3.5 text-white shadow-xs transition-all hover:-translate-y-px hover:bg-amber-hover hover:shadow-glow"
              >
                <Link href="/receipts" className="flex items-center gap-1.5">
                  <UploadCloud className="size-3.5" />
                  <span className="text-[12px] font-medium">Upload</span>
                </Link>
              </Button>

              <div className="mx-1 hidden h-6 w-px bg-border-default md:block" />

              <div className="flex size-8 items-center justify-center rounded-full border border-amber-border/50 bg-amber-surface text-[11px] font-bold text-amber">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
