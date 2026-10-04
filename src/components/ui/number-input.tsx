import * as React from "react"

import { Input } from "@/components/ui/input"

export type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max" | "step"> & {
  /** The text in the field; "" is empty. Parse it with parseNumberInput. */
  value: string
  onChange: (value: string) => void
  /** Allow a fractional part (one comma or dot, normalized to a dot). */
  decimal?: boolean
}

const INTEGER = /^\d*$/
const DECIMAL = /^\d*\.?\d*$/

/**
 * A number field without the browser spinners: a text input that accepts only
 * digits (and one decimal separator with `decimal`). Range and emptiness are
 * validated by the form, which reads the text through parseNumberInput.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, decimal = false, ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(event) => {
        const next = event.target.value.replace(",", ".")
        if ((decimal ? DECIMAL : INTEGER).test(next)) onChange(next)
      }}
      {...props}
    />
  )
)
NumberInput.displayName = "NumberInput"

/** "" → null (not set); a positive number → the number; anything else → NaN. */
export function parseNumberInput(value: string, integer = false): number | null {
  const text = value.trim()
  if (text === "") return null
  const number = Number(text)
  if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isInteger(number))) return Number.NaN
  return number
}
