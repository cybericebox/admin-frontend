"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy } from "lucide-react"

import { CREST_SRC } from "@/components/brand/Logo"
import { FeedbackLink } from "@/components/FeedbackLink"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/components/ui/load-error"
import { BRAND } from "@/i18n/brand"
import { t } from "@/i18n/t"
import { feedbackHref } from "@/lib/feedback"
import { isServerError, reference, reportHref } from "@/lib/errorReport"

const HOME = "/dashboard"

// Browser history back; a tab opened straight on the failing page goes home instead.
export function goBack() {
  if (window.history.length > 1) window.history.back()
  // a full load leaves the failed render state behind
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  else window.location.assign(HOME)
}

/**
 * The one error / not-found layout (DS patterns/error-page): big muted status, title, one
 * line, actions and, for an error that carries a platform code, the faint «Код помилки» line.
 * `page` = the shell could not render (global error): centred in the viewport with the
 * thin footer (crest, brand, «На головну», «Надіслати відгук»). `block` = the shell is
 * already there and only the page failed: the same column inside the content area, no
 * footer, no crest. `onRetry` makes «Оновити» the primary action, otherwise «На головну»;
 * «Назад» is always the quiet second one. `title` may be two lines.
 */
export function ErrorPage({ mode, status, title, text, onRetry, error, report = false }: {
  mode: "page" | "block"
  /** The HTTP status shown as the big code. */
  status: number
  title: string | readonly [string, string]
  text: string
  onRetry?: () => void
  /** The failure, for its platform error code (the numeric Status.Code or the HTTP status). */
  error?: unknown
  /**
   * A 500 page. A backend 5xx says it is already journaled and shows the reference number
   * («{code}-{rid8}», copyable); a frontend crash says nothing was journaled. Both get
   * «Повідомити деталі», the prefilled feedback mail. A 404 leaves this off.
   */
  report?: boolean
}) {
  const ref = report ? reference(error) : undefined
  const code = ref ? undefined : errorCode(error)
  const body = report && isServerError(error) ? t("error.page.serverBody") : text
  const page = mode === "page"
  const Heading = page ? "h1" : "h2"
  const column = (
    <>
      <p className="ib-error__code" aria-hidden="true">{status}</p>
      <Heading className="ib-error__title">
        {typeof title === "string" ? title : title.map((line) => <span key={line} className="ib-error__line">{line}</span>)}
      </Heading>
      <p className="ib-error__text">{body}</p>
      <div className="ib-error__actions">
        {onRetry
          ? <Button onClick={onRetry}>{t("error.page.retry")}</Button>
          : <Button asChild><Link href={HOME}>{t("error.goHome")}</Link></Button>}
        <button type="button" className="ib-error__back" onClick={goBack}>{t("error.page.back")}</button>
      </div>
      {ref && <Reference value={ref} />}
      {code !== undefined && <p className="ib-error__ref">{t("error.load.code", { code })}</p>}
      {report && <ReportLink error={error} />}
    </>
  )
  if (!page) return <div role="alert" className="ib-error ib-error--block ib-error--fill"><div className="ib-error__main">{column}</div></div>
  return (
    <div className="ib-error ib-error--page">
      <main id="main" tabIndex={-1} className="ib-error__main">{column}</main>
      <footer className="ib-error__footer">
        {/* a plain anchor: the router is gone when the root layout failed */}
        <a className="ib-error__brand" href={HOME}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CREST_SRC} width={18} height={18} alt="" />{BRAND}
        </a>
        <nav className="ib-error__links" aria-label={t("error.page.links")}>
          <a href={HOME}>{t("error.goHome")}</a>
          <FeedbackLink />
        </nav>
      </footer>
    </div>
  )
}

/** The route-level 404 inside the shell, or an in-page «not found» block with its own context title. */
export function NotFoundBlock({ title = t("error.notFound"), body = t("error.notFoundDescription") }: { title?: string; body?: string }) {
  return <ErrorPage mode="block" status={404} title={title} text={body} />
}

/** «Номер звернення: …» with a small copy button; the result is announced through a live region. */
function Reference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <p className="ib-error__ref">
      {t("error.report.ref")}: {value}
      <button type="button" className="ib-error__copy" aria-label={t("error.report.copy")} onClick={copy}>
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      <span role="status" className="sr-only">{copied ? t("error.report.copied") : ""}</span>
    </p>
  )
}

/** The feedback mail prefilled with the page, time and the reference (or the crash message); built at click time, the URL and clock are the browser's. */
function ReportLink({ error }: { error: unknown }) {
  const fill = (event: { currentTarget: HTMLAnchorElement }) => { event.currentTarget.href = reportHref(error) }
  const ref = reference(error)
  return <a className="ib-error__back" href={feedbackHref(ref ? t("error.report.subjectRef", { ref }) : t("error.report.subject"))} onClick={fill} onAuxClick={fill}>{t("error.report.link")}</a>
}
