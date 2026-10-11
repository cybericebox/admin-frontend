import { Button, type ButtonProps } from "./button"
import { cn } from "@/utils/cn"

/** Reserve the submit's space while a clean form has no visible or focusable Save action. */
export function SaveButton({ dirty, busy, disabled, className, ...props }: ButtonProps & { dirty: boolean }) {
  const visible = dirty || busy
  return <Button {...props} busy={busy} disabled={disabled || !visible} aria-hidden={!visible || undefined} tabIndex={visible ? props.tabIndex : -1} className={cn(className, !visible && "invisible")} />
}
