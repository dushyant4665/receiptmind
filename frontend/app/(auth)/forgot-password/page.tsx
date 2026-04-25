"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="w-full max-w-[400px] rounded-[12px] border border-border-default bg-bg-surface p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[6px] bg-text-primary text-[11px] font-medium tracking-[1px] text-white">
            RM
          </span>
          <span className="text-[15px] font-medium tracking-[-0.3px] text-text-primary">ReceiptMind</span>
        </div>
        {!sent ? (
          <>
            <h1 className="text-[18px] font-medium text-text-primary">Reset your password</h1>
            <p className="mt-1 text-[13px] text-text-muted">
              Enter your email and we&apos;ll send a reset link.
            </p>
          </>
        ) : null}
      </div>

      {!sent ? (
        <>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setSent(true);
            }}
          >
            <div>
              <Label htmlFor="email" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                Work email
              </Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <Button type="submit" variant="amber" className="w-full">
              Send reset link
            </Button>
          </form>
          <p className="mt-5">
            <Link href="/login" className="text-[13px] text-text-muted transition-[color] hover:text-text-primary">
              &larr; Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-8 items-center justify-center rounded-full bg-success-surface text-success">
            <Check className="size-4" />
          </div>
          <h2 className="text-[18px] font-medium text-text-primary">Check your inbox</h2>
          <p className="mt-2 text-[13px] leading-[1.6] text-text-muted">
            We sent a reset link to {email || "your email"}. It expires in 15 minutes.
          </p>
          <p className="mt-4">
            <button type="button" className="text-[13px] text-amber transition-[color] hover:text-amber-hover">
              Didn&apos;t receive it? Resend
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
