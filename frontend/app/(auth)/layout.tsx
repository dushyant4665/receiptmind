import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (session?.accessToken) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-amber-surface/40 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-amber-surface/20 via-transparent to-transparent" />
      </div>
      {children}
    </div>
  );
}
