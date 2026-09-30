import { describe, expect, it } from "vitest"
import { smtpErrorView } from "./smtpError"

describe("smtpErrorView", () => {
  it.each([
    ["smtp_auth", "SMTP-сервер відхилив вхід: перевірте логін і пароль SMTP"],
    ["smtp_rcpt", "Адресу одержувача відхилено"],
    ["smtp_rejected", "Лист відхилено сервером (можливо, адресу не підтверджено в SES)"],
    ["smtp_connect", "Не вдалося з'єднатися з SMTP-сервером"],
  ])("maps %s to a human line and keeps the raw text as details", (kind, text) => {
    expect(smtpErrorView(kind, "535", "535 raw")).toEqual({ text, technical: "535 raw" })
  })

  it("puts the reply code into smtp_other and drops it when empty", () => {
    expect(smtpErrorView("smtp_other", "421", "421 busy")).toEqual({ text: "Помилка SMTP (421)", technical: "421 busy" })
    expect(smtpErrorView("smtp_other", "", "boom")).toEqual({ text: "Помилка SMTP", technical: "boom" })
  })

  it("keeps the raw text for an empty or unknown kind (deferred texts too)", () => {
    expect(smtpErrorView("", "", "Відкладено: ліміт")).toEqual({ text: "Відкладено: ліміт", technical: "" })
    expect(smtpErrorView("weird", "", "raw")).toEqual({ text: "raw", technical: "" })
    expect(smtpErrorView(undefined, undefined, "raw")).toEqual({ text: "raw", technical: "" })
  })

  it("returns null without any error", () => {
    expect(smtpErrorView("", "", "")).toBeNull()
  })
})
