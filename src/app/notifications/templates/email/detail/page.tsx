"use client"

/**
 * Email block-template editor page.
 *
 * Route: /notifications/templates/email/detail?id=<uuid>
 * No dynamic [id] segment — compatible with Next.js static export.
 *
 * Layout:
 *   Left  — Subject (VariableRichText dotted), Preheader, BlockEditor body,
 *            STYLING section (4 ColorPickers + 2 numeric inputs)
 *   Right — EmailPreview (live, fed from current form state)
 *
 * Status rules:
 *   draft       → editable; Save + Publish buttons shown
 *   published   → READ-ONLY; Rollback button shown
 *   unpublished → READ-ONLY; Rollback button shown
 *   (new)       → editable; Save button; type selector visible
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Send } from "lucide-react"
import { t } from "@/i18n/t"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { TestNotificationModal } from "@/components/notifications/editor/TestNotificationModal"
import {
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  publishEmailTemplate,
  rollbackEmailTemplate,
  listBlockPresets,
  createBlockPreset,
} from "@/api/notifications/emailTemplates"
import type {
  EmailTemplate,
  BlockPreset,
} from "@/api/notifications/emailTemplates"
import type { EmailBodyBlock } from "@/components/notifications/editor/previewHtml"
import { BlockEditor } from "@/components/notifications/editor/BlockEditor"
import { VariableRichText } from "@/components/notifications/editor/VariableRichText"
import { EmailPreview } from "@/components/notifications/editor/EmailPreview"
import { ColorPicker } from "@/components/notifications/editor/ColorPicker"
import { useNotificationTypes } from "@/components/notifications/templateTypes"
import { notifTypeLabel } from "@/utils/notifType"
import { SelectMenu } from "@/components/ui/select-menu"
import { StatusPill } from "@/components/notifications/StatusPill"
import { statusLabelKey } from "@/lib/templateStatus"

// ── Detail inner component (needs Suspense for useSearchParams) ───────────────

function Detail() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  const router = useRouter()

  // ── Remote state ──────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // ── Load nonce — incremented whenever we (re)populate form from server data ──
  // Changing this causes mount-initialized editors (VariableRichText, BlockEditor)
  // to remount so they pick up the new initial value instead of showing stale content.
  const [loadNonce, setLoadNonce] = useState(0)

  // ── Test modal state ──────────────────────────────────────────────────────
  const [testOpen, setTestOpen] = useState(false)
  // Stable channels array — avoids passing a new [] literal on every render which
  // would cause TestNotificationModal's seed effect to re-run mid-session.
  const testChannels = useMemo(() => ["email"], [])

  // ── Form state (source of truth after first load) ─────────────────────────
  const [notificationType, setNotificationType] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [body, setBody] = useState<EmailBodyBlock[]>([])
  const [styling, setStyling] = useState<Record<string, unknown>>({})

  // ── Presets ───────────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<BlockPreset[]>([])

  // ── Notification type catalog ─────────────────────────────────────────────
  const notifTypes = useNotificationTypes()

  // ── Load template (once, on id change) ───────────────────────────────────
  const load = useCallback(() => {
    if (!id) {
      // New template — nothing to fetch, just show blank form
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    getEmailTemplate(id)
      .then((tpl) => {
        setTemplate(tpl)
        setNotificationType(tpl.NotificationType)
        setSubject(tpl.Subject)
        setPreheader(tpl.Preheader)
        setBody(tpl.Body)
        setStyling(tpl.Styling)
        setLoadNonce((n) => n + 1)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  // Load block presets once
  useEffect(() => {
    listBlockPresets()
      .then(setPresets)
      .catch(() => {/* non-fatal */})
  }, [])

  // ── Derived: variables for email channel (for the current type) ───────────
  const emailVariables = useMemo(() => {
    const entry = notifTypes.find((nt) => nt.Type === notificationType)
    if (!entry || !entry.Channels.includes("email")) return []
    return entry.Variables.map((v) => ({ name: v.Name, description: v.Description }))
  }, [notifTypes, notificationType])

  // ── Derived: preview values (each variable's Default from catalog) ─────────
  const previewValues = useMemo(() => {
    const entry = notifTypes.find((nt) => nt.Type === notificationType)
    if (!entry) return {}
    return Object.fromEntries(entry.Variables.map((v) => [v.Name, v.Default]))
  }, [notifTypes, notificationType])

  // ── Derived: presets map for EmailPreview ─────────────────────────────────
  const presetsMap = useMemo(
    () => Object.fromEntries(presets.map((p) => [p.ID, p.Blocks])),
    [presets],
  )

  // ── Styling helpers ───────────────────────────────────────────────────────
  function setStylingKey(key: string, val: unknown) {
    setStyling((prev) => ({ ...prev, [key]: val }))
  }

  const ctaBgColor    = (styling.cta_bg_color     as string  | undefined) ?? "#000000"
  const ctaTextColor  = (styling.cta_text_color   as string  | undefined) ?? "#ffffff"
  const textColor     = (styling.text_color        as string  | undefined) ?? "#333333"
  const headingColor  = (styling.heading_color     as string  | undefined) ?? "#000000"
  const ctaBorderRadius = parseInt(String(styling.cta_border_radius ?? '4px'), 10) || 0
  const ctaFontSize   = parseInt(String(styling.cta_font_size ?? '14px'), 10) || 14

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSave() {
    setBusy(true)
    setSaveError(false)
    try {
      if (!template?.ID) {
        // Create new
        const created = await createEmailTemplate({
          NotificationType: notificationType,
          Subject: subject,
          Preheader: preheader,
          Body: body,
          Styling: styling,
        })
        setTemplate(created)
        router.replace(`/notifications/templates/email/detail?id=${created.ID}`)
      } else {
        // Update existing draft
        const updated = await updateEmailTemplate(template.ID, {
          Subject: subject,
          Preheader: preheader,
          Body: body,
          Styling: styling,
        })
        setTemplate(updated)
      }
    } catch {
      setSaveError(true)
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!template) return
    setBusy(true)
    setSaveError(false)
    try {
      const updated = await publishEmailTemplate(template.ID)
      setTemplate(updated)
    } catch {
      setSaveError(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleRollback() {
    if (!template) return
    setBusy(true)
    setSaveError(false)
    try {
      const updated = await rollbackEmailTemplate(template.ID)
      setTemplate(updated)
      // Re-sync form state from the rolled-back template
      setSubject(updated.Subject)
      setPreheader(updated.Preheader)
      setBody(updated.Body)
      setStyling(updated.Styling)
      setLoadNonce((n) => n + 1)
    } catch {
      setSaveError(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePreset(blocks: EmailBodyBlock[], name: string) {
    await createBlockPreset({ Name: name, Description: "", Blocks: blocks })
    const fresh = await listBlockPresets()
    setPresets(fresh)
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="frost-panel frost-in flex justify-center rounded-lg p-8">
        <Spinner label={t("admin.loading")} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8">
        <Link
          href="/notifications/templates/email"
          className="text-sm text-primary hover:underline"
        >
          ← {t("admin.notif.tpl.email")}
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("admin.notif.tpl.empty")}
        </p>
      </div>
    )
  }

  const isNew      = !id || !template
  const isReadOnly = template?.Status === "published" || template?.Status === "unpublished"
  const isDraft    = template?.Status === "draft"

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="frost-panel frost-in rounded-lg p-6">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <Link
          href="/notifications/templates/email"
          className="text-sm text-primary hover:underline shrink-0"
        >
          ← {t("admin.notif.tpl.email")}
        </Link>

        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">
            {notificationType ? notifTypeLabel(notificationType) : t("admin.notif.tpl.choose")}
          </h1>
          {template && <StatusPill status={template.Status} label={t(statusLabelKey(template.Status))} />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Send test: shown when a template is loaded */}
          {template !== null && (
            <Button variant="outline" onClick={() => setTestOpen(true)}>
              <Send className="h-4 w-4 mr-1" />
              {t("admin.notif.test.button")}
            </Button>
          )}
          {/* Save: shown when not published/unpublished */}
          {!isReadOnly && (
            <Button onClick={() => void handleSave()} disabled={busy}>
              {t("admin.notif.tpl.save")}
            </Button>
          )}
          {/* Publish: shown for draft */}
          {isDraft && (
            <Button variant="outline" onClick={() => void handlePublish()} disabled={busy}>
              {t("admin.notif.tpl.publish")}
            </Button>
          )}
          {/* Rollback: shown for published or unpublished */}
          {(template?.Status === "published" || template?.Status === "unpublished") && (
            <Button variant="outline" onClick={() => void handleRollback()} disabled={busy}>
              {t("admin.notif.tpl.rollback")}
            </Button>
          )}
          {saveError && (
            <span className="text-sm text-destructive">{t("admin.notif.tpl.saveError")}</span>
          )}
        </div>
      </div>

      {/* ── Type selector (new template only) ── */}
      {isNew && (
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {t("admin.notif.tpl.type")}
          </label>
          <SelectMenu
            value={notificationType}
            onChange={setNotificationType}
            placeholder={t("admin.notif.tpl.choose")}
            options={notifTypes
              .filter((nt) => nt.Channels.includes("email"))
              .map((nt) => ({ value: nt.Type, label: notifTypeLabel(nt.Type) }))}
          />
        </div>
      )}

      {/* ── Two-column editor layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* ── Left column: editor fields ── */}
        <div className="space-y-5 min-w-0">

          {/* Subject */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {t("admin.notif.tpl.subject")}
            </label>
            <div
              data-testid="subject-wrapper"
              {...(isReadOnly ? { inert: true } : {})}
              className={isReadOnly ? "opacity-60" : ""}
            >
              <VariableRichText
                key={`subject-${loadNonce}`}
                value={subject}
                onChange={setSubject}
                variables={emailVariables}
                placeholder={t("admin.notif.tpl.subject")}
                dotted
              />
            </div>
          </div>

          {/* Preheader */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {t("admin.notif.tpl.preheader")}
            </label>
            <div
              data-testid="preheader-wrapper"
              {...(isReadOnly ? { inert: true } : {})}
              className={isReadOnly ? "opacity-60" : ""}
            >
              <VariableRichText
                key={`preheader-${loadNonce}`}
                value={preheader}
                onChange={setPreheader}
                variables={emailVariables}
                placeholder={t("admin.notif.tpl.preheader")}
                dotted
              />
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {t("admin.notif.tpl.body")}
            </label>
            {isReadOnly ? (
              <div
                data-testid="body-readonly"
                className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground"
              >
                {body.length} {body.length === 1 ? "block" : "blocks"} — read-only while{" "}
                {template ? t(statusLabelKey(template.Status)) : ""}. {t("admin.notif.tpl.rollback")} to edit.
              </div>
            ) : (
              <BlockEditor
                key={`body-${loadNonce}`}
                value={body}
                onChange={setBody}
                variables={emailVariables}
                presets={presets}
                onSavePreset={handleSavePreset}
              />
            )}
          </div>

          {/* Styling */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {t("admin.notif.tpl.styling")}
            </div>
            <div
              data-testid="styling-wrapper"
              {...(isReadOnly ? { inert: true } : {})}
              className={`grid grid-cols-2 gap-4${isReadOnly ? " opacity-60" : ""}`}
            >
              <ColorPicker
                label="CTA Background"
                value={ctaBgColor}
                onChange={(v) => setStylingKey("cta_bg_color", v)}
              />
              <ColorPicker
                label="CTA Text"
                value={ctaTextColor}
                onChange={(v) => setStylingKey("cta_text_color", v)}
              />
              <ColorPicker
                label="Text Color"
                value={textColor}
                onChange={(v) => setStylingKey("text_color", v)}
              />
              <ColorPicker
                label="Heading Color"
                value={headingColor}
                onChange={(v) => setStylingKey("heading_color", v)}
              />
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  CTA Border Radius (px)
                </span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={ctaBorderRadius}
                  onChange={(e) =>
                    setStylingKey("cta_border_radius", `${parseInt(e.target.value, 10) || 0}px`)
                  }
                  disabled={isReadOnly}
                  aria-label="CTA border radius"
                  className="w-20 rounded-md border border-border bg-secondary/40 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  CTA Font Size (px)
                </span>
                <input
                  type="number"
                  min={8}
                  max={48}
                  value={ctaFontSize}
                  onChange={(e) =>
                    setStylingKey("cta_font_size", `${parseInt(e.target.value, 10) || 14}px`)
                  }
                  disabled={isReadOnly}
                  aria-label="CTA font size"
                  className="w-20 rounded-md border border-border bg-secondary/40 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── Right column: live email preview ── */}
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.notif.editor.previewTitle")}
          </div>
          <div className="sticky top-4">
            <EmailPreview
              body={body}
              styling={styling}
              presets={presetsMap}
              previewValues={previewValues}
            />
          </div>
        </div>

      </div>

      {/* ── Test notification modal ── */}
      {template !== null && (
        <TestNotificationModal
          open={testOpen}
          onClose={() => setTestOpen(false)}
          notificationType={template.NotificationType}
          channels={testChannels}
          templateId={template?.ID}
        />
      )}
    </div>
  )
}

// ── Page export (Suspense boundary required for useSearchParams in static export) ──

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={
        <div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">
          {t("admin.notif.noAccess")}
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="frost-panel frost-in flex justify-center rounded-lg p-8">
            <Spinner label={t("admin.loading")} />
          </div>
        }
      >
        <Detail />
      </Suspense>
    </RequirePermission>
  )
}
