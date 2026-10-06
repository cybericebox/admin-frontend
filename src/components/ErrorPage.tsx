"use client"

import Link from "next/link"

import { CREST_SRC } from "@/components/brand/Logo"
import { FeedbackLink } from "@/components/FeedbackLink"
import { Button } from "@/components/ui/button"
import { errorCode } from "@/components/ui/load-error"
import { BRAND } from "@/i18n/brand"
import { t } from "@/i18n/t"

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
export function ErrorPage({ mode, status, title, text, onRetry, error }: {
  mode: "page" | "block"
  /** The HTTP status shown as the big code. */
  status: number
  title: string | readonly [string, string]
  text: string
  onRetry?: () => void
  /** The failure, for its platform error code (the numeric Status.Code or the HTTP status). */
  error?: unknown
}) {
  const code = errorCode(error)
  const page = mode === "page"
  const Heading = page ? "h1" : "h2"
  const column = (
    <>
      <p className="ib-error__code" aria-hidden="true">{status}</p>
      <Heading className="ib-error__title">
        {typeof title === "string" ? title : title.map((line) => <span key={line} className="ib-error__line">{line}</span>)}
      </Heading>
      <p className="ib-error__text">{text}</p>
      <div className="ib-error__actions">
        {onRetry
          ? <Button onClick={onRetry}>{t("error.page.reload")}</Button>
          : <Button asChild><Link href={HOME}>{t("error.goHome")}</Link></Button>}
        <button type="button" className="ib-error__back" onClick={goBack}>{t("error.page.back")}</button>
      </div>
      {code !== undefined && <p className="ib-error__ref">{t("error.load.code", { code })}</p>}
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
