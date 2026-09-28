import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Alert, AlertDescription } from "./alert"

describe("Alert", () => {
  it.each(["info", "success", "warning", "destructive"] as const)(
    "renders %s without a thick left accent strip",
    (variant) => {
      render(<Alert variant={variant}><AlertDescription>Message</AlertDescription></Alert>)
      const alert = screen.getByRole("alert")
      expect(alert).toHaveTextContent("Message")
      expect(alert).not.toHaveClass("border-l-4")
    },
  )
})
