import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { authOptions } from "@/lib/auth";

export default async function DashboardRouteLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <DashboardLayout initialUser={session.user}>{children}</DashboardLayout>;
}
