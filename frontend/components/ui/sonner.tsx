"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="h-4 w-4 text-green" />
        ),
        info: (
          <InfoIcon className="h-4 w-4 text-blue" />
        ),
        warning: (
          <TriangleAlertIcon className="h-4 w-4 text-amber" />
        ),
        error: (
          <OctagonXIcon className="h-4 w-4 text-red" />
        ),
        loading: (
          <Loader2Icon className="h-4 w-4 text-ink3" />
        ),
      }}
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#0a0a0a",
          "--normal-border": "#e8e8e4",
          "--border-radius": "8px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
