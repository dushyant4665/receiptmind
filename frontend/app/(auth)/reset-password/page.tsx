"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postApiData } from "@/lib/api-client";

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || password.length < 8) {
      toast.error("Use an 8+ character password.");
      return;
    }
    setIsSubmitting(true);
    try {
      await postApiData("/auth/reset-password", { token, new_password: password });
      setDone(true);
      toast.success("Password reset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-border-default bg-white p-8 shadow-md">
      <h1 className="text-[20px] font-semibold text-text-primary">Set new password</h1>
      {done ? (
        <div className="mt-4 space-y-4">
          <p className="text-[13px] text-text-muted">Your password has been updated. You can sign in now.</p>
          <Button asChild className="w-full"><Link href="/login">Go to login</Link></Button>
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" />
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Reset password"}</Button>
        </form>
      )}
    </div>
  );
}
