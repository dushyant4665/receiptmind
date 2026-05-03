import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-all duration-150",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-white",
        secondary: "border-border-default bg-bg-subtle text-text-muted",
        accent: "border-amber-border bg-amber-surface text-amber",
        outline: "border-border-default bg-white text-text-secondary",
        ghost: "border-transparent bg-transparent text-text-muted",
        destructive: "border-red bg-red-surface text-red",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
