"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative h-9 w-9"
    >
      <Sun className="h-4 w-4" />
      <Moon className="absolute h-4 w-4 opacity-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
