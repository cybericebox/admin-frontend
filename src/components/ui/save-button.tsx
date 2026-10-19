import { t } from "@/i18n/t"
import { Button, type ButtonProps } from "./button"

/** Keep Save visible and disable it while the form matches its saved baseline; while saving it says «Зберігаємо…». */
export function SaveButton({ dirty, busy, busyLabel, disabled, ...props }: Omit<ButtonProps, "busy" | "busyLabel"> & { dirty: boolean; busy?: boolean; busyLabel?: string }) {
  return <Button {...props} busy={busy ?? false} busyLabel={busyLabel ?? t("busy.saving")} disabled={disabled || !dirty} />
}
