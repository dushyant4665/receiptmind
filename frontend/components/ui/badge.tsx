import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[4px] border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-150",
  {
    variants: {
      variant: {
        default: "border-text-primary bg-text-primary text-white",
        secondary: "border-border-default bg-bg-subtle text-text-muted",
        accent: "border-amber-border bg-amber-surface text-amber",
        outline: "border-border-default bg-bg-surface text-text-secondary",
        ghost: "border-transparent bg-transparent text-text-muted",
        destructive: "border-error bg-error-surface text-error",
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
