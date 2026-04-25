import { cn } from "@/lib/utils";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-[6px] text-[11px] font-medium tracking-[1px]",
          light ? "bg-text-invert text-bg-invert" : "bg-text-primary text-white",
        )}
      >
        RM
      </div>
      <p
        className={cn(
          "text-[15px] font-medium tracking-[-0.3px]",
          light ? "text-text-invert" : "text-text-primary",
        )}
      >
        ReceiptMind
      </p>
    </div>
  );
}
