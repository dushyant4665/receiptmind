import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-all duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-white hover:bg-ink2 shadow-xs hover:shadow-sm hover:-translate-y-px",
        outline:
          "border border-border-default bg-white text-text-secondary hover:border-ink5 hover:text-text-primary hover:shadow-xs",
        secondary:
          "border border-border-default bg-white text-text-secondary hover:border-ink5 hover:text-text-primary",
        ghost:
          "border border-transparent bg-transparent text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        destructive:
          "bg-red text-white hover:bg-red/90 shadow-xs",
        amber:
          "bg-amber text-white hover:bg-amber-hover shadow-xs hover:shadow-glow hover:-translate-y-px",
        link: "text-amber underline-offset-4 hover:text-amber-hover hover:underline",
      },
      size: {
        default: "h-9 px-4",
        xs: "h-7 px-3 text-[11px]",
        sm: "h-8 px-3.5 text-[12px]",
        lg: "h-10 px-5 text-[14px]",
        icon: "size-8 p-0",
        "icon-xs": "size-7 p-0",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
