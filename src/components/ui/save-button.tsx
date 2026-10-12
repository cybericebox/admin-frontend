import { Button, type ButtonProps } from "./button"

/** Keep Save visible and disable it while the form matches its saved baseline. */
export function SaveButton({ dirty, busy, disabled, ...props }: ButtonProps & { dirty: boolean }) {
  return <Button {...props} busy={busy} disabled={disabled || !dirty} />
}
