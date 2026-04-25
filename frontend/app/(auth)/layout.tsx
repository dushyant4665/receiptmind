import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (session?.accessToken) {
    redirect("/dashboard");
  }

  return <div className="flex min-h-screen items-center justify-center bg-bg-page px-4 py-10">{children}</div>;
}
