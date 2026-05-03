import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-border-default bg-white px-3 text-[13px] text-text-primary transition-all duration-150 outline-none placeholder:text-text-ghost hover:border-ink5 focus-visible:border-ink3 focus-visible:ring-2 focus-visible:ring-ink/5 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
