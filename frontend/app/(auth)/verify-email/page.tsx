"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postApiData } from "@/lib/api-client";

type VerifyResponse = {
  access_token: string;
  refresh_token: string;
};

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [isResending, setIsResending] = useState(false);
  const [state, setState] = useState(token ? "Verifying your email..." : "Check your inbox");

  useEffect(() => {
    if (!token) return;
    let active = true;
    postApiData<VerifyResponse>("/auth/verify-email", { token })
      .then(async () => {
        if (!active) return;
        setState("Email verified. Redirecting to login...");
        toast.success("Email verified");
        router.push("/login");
      })
      .catch((error) => {
        if (!active) return;
        setState(error instanceof Error ? error.message : "Verification failed");
        toast.error("Verification failed");
      });
    return () => {
      active = false;
    };
  }, [router, token]);

  const resend = async () => {
    if (!email) {
      toast.error("Enter your email.");
      return;
    }
    setIsResending(true);
    try {
      await postApiData("/auth/resend-verification", { email });
      toast.success("Verification email sent.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border-default bg-white p-8 shadow-md">
      <h1 className="text-[20px] font-semibold text-text-primary">Verify your email</h1>
      <p className="mt-2 text-[13px] leading-6 text-text-muted">{state}</p>
      {!token && (
        <div className="mt-5 space-y-3">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
          <Button className="w-full" disabled={isResending} onClick={resend}>
            {isResending ? "Sending..." : "Resend verification email"}
          </Button>
        </div>
      )}
      <Button variant="ghost" className="mt-4 w-full" onClick={() => void signIn()}>
        Back to login
      </Button>
    </div>
  );
}
