import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-[13px] font-medium transition-[background-color,border-color,color,opacity,transform] duration-150 ease-in outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-text-primary text-white hover:opacity-82",
        outline:
          "border border-border-default bg-transparent text-text-secondary hover:border-border-strong hover:text-text-primary",
        secondary:
          "border border-border-default bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary",
        ghost:
          "border border-border-default bg-transparent text-text-secondary hover:border-border-strong hover:text-text-primary",
        destructive:
          "bg-error text-white hover:opacity-82",
        amber:
          "bg-amber text-white hover:bg-amber-hover",
        link: "text-amber underline-offset-4 hover:text-amber-hover hover:underline",
      },
      size: {
        default: "h-9 px-4",
        xs: "h-8 px-3 text-[12px]",
        sm: "h-9 px-4",
        lg: "h-10 px-5 text-[14px]",
        icon: "size-8 p-0",
        "icon-xs": "size-8 p-0",
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
