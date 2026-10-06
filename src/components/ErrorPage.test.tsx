import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import uk from "../../messages/uk.json"
import en from "../../messages/en.json"
import { ApiError } from "@/api/client"
import { ErrorPage, NotFoundBlock } from "./ErrorPage"

const noop = vi.fn()

describe("ErrorPage", () => {
  it("page mode: centred column plus the footer with crest, brand, home and feedback", () => {
    const html = renderToStaticMarkup(<ErrorPage mode="page" status={500} title="Не вдалося завантажити сторінку" text="Текст" onRetry={noop} />)
    expect(html).toContain("ib-error--page")
    expect(html).toContain("<h1")
    expect(html).toContain(">500<")
    expect(html).toContain("<footer")
    expect(html).toContain("Cyber ICE Box")
    expect(html).toContain("crest-128.png")
    expect(html).toContain(">На головну<")
    expect(html).toContain(">Надіслати відгук<")
    expect(html).toContain(">Спробувати ще раз<")
    expect(html).toContain(">Назад<")
  })

  it("block mode: the same column, no footer, no crest", () => {
    const html = renderToStaticMarkup(<ErrorPage mode="block" status={500} title="Не вдалося завантажити сторінку" text="Текст" onRetry={noop} />)
    expect(html).toContain("ib-error--block")
    expect(html).toContain("<h2")
    expect(html).not.toContain("<footer")
    expect(html).not.toContain("crest")
    expect(html).not.toContain("Надіслати відгук")
  })

  it("shows the code line only for an error that carries a code", () => {
    const withCode = renderToStaticMarkup(<ErrorPage mode="block" status={500} title="T" text="x" onRetry={noop} error={{ code: 50310 }} />)
    expect(withCode).toContain("Код помилки: 50310")
    const without = renderToStaticMarkup(<ErrorPage mode="block" status={500} title="T" text="x" onRetry={noop} error={new Error("secret stack detail")} />)
    expect(without).not.toContain("Код помилки")
    expect(without).not.toContain("secret stack detail")
  })

  it("a backend 5xx: journaled text, copyable reference «code-rid8» and the report link", () => {
    const err = new ApiError(500, {}, "x", undefined, 50310, undefined, "ab12cd34-5678-4abc-8def-000000000000")
    const html = renderToStaticMarkup(<ErrorPage mode="block" status={500} title="T" text="crash text" onRetry={noop} error={err} report />)
    expect(html).toContain("Ми вже отримали звіт про цю помилку")
    expect(html).toContain("Номер звернення: 50310-ab12cd34")
    expect(html).toContain('aria-label="Копіювати номер звернення"')
    expect(html).toContain(">Повідомити деталі<")
    expect(html).not.toContain("Код помилки")
  })

  it("a frontend crash: no journal line, no reference, still the report link", () => {
    const html = renderToStaticMarkup(<ErrorPage mode="block" status={500} title="T" text="crash text" onRetry={noop} error={new Error("boom")} report />)
    expect(html).toContain("crash text")
    expect(html).not.toContain("Ми вже отримали звіт")
    expect(html).not.toContain("Номер звернення")
    expect(html).toContain(">Повідомити деталі<")
  })

  it("a 404 has neither the reference nor the report link", () => {
    const html = renderToStaticMarkup(<NotFoundBlock />)
    expect(html).not.toContain("Повідомити деталі")
    expect(html).not.toContain("Номер звернення")
  })

  it("a two-line title renders each line; without onRetry the primary action is the home link", () => {
    const html = renderToStaticMarkup(<ErrorPage mode="block" status={404} title={["Рядок один", "Рядок два"]} text="x" />)
    expect(html).toContain('<span class="ib-error__line">Рядок один</span>')
    expect(html).toContain('<span class="ib-error__line">Рядок два</span>')
    expect(html).toContain('href="/dashboard"')
    expect(html).not.toContain(">Спробувати ще раз<")
  })

  it("NotFoundBlock: 404 with the default or a context title", () => {
    const html = renderToStaticMarkup(<NotFoundBlock />)
    expect(html).toContain("Сторінку не знайдено")
    expect(html).toContain(">404<")
    expect(renderToStaticMarkup(<NotFoundBlock title="Шаблон не знайдено" />)).toContain("Шаблон не знайдено")
  })

  it("has the texts in both catalogs", () => {
    for (const key of ["error.page.title", "error.page.body", "error.page.reload", "error.page.back", "error.page.links", "error.notFound", "error.goHome", "serviceGate.title", "serviceGate.body"] as const) {
      expect(uk[key]).toBeTruthy()
      expect(en[key]).toBeTruthy()
    }
    expect(uk["serviceGate.title"]).toBe("Сервер платформи тимчасово недоступний")
  })
})
