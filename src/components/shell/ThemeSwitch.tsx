"use client"

import { useEffect, useRef, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { t } from "@/i18n/t"
import { readThemeChoice, setThemeChoice, watchSystemTheme, type ThemeChoice } from "@/lib/theme"
import { Segmented } from "@/components/ui/segmented"

const OPTIONS = [
  { value: "light", icon: Sun, label: "theme.light" },
  { value: "dark", icon: Moon, label: "theme.dark" },
  { value: "system", icon: Monitor, label: "theme.system" },
] as const

export const THEME_OPTIONS = OPTIONS

// Shared by the top bar switch and the account menu (the switch moves into the menu on narrow screens).
export function useThemeChoice(): [ThemeChoice, (next: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system")
  const choiceRef = useRef<ThemeChoice>("system")

  useEffect(() => {
    const stored = readThemeChoice()
    choiceRef.current = stored
    queueMicrotask(() => setChoice(stored))
    return watchSystemTheme(() => choiceRef.current)
  }, [])

  function select(next: ThemeChoice) {
    choiceRef.current = next
    setChoice(next)
    setThemeChoice(next)
  }
  return [choice, select]
}

export function ThemeSwitch() {
  const [choice, select] = useThemeChoice()

  return <Segmented
    small
    value={choice}
    onChange={select}
    label={t("theme.label")}
    options={OPTIONS.map(({ value, icon: Icon, label }) => ({ value, ariaLabel: t(label), label: <Icon aria-hidden="true" /> }))}
  />
}
