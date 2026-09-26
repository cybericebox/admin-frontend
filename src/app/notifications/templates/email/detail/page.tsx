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
 *   Right — EmailPreview (live, backend-rendered from current form state)
 *
 * Status rules:
 *   draft       → editable; Save + Publish buttons shown
 *   published   → READ-ONLY; edit into a new draft
 *   unpublished → READ-ONLY; restore as a new draft
 *   (new)       → editable; Save button; type selector visible
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Send } from "lucide-react"
import { t } from "@/i18n/t"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { TestNotificationModal } from "@/components/notifications/editor/TestNotificationModal"
import { TemplateVersions } from "@/components/notifications/editor/TemplateVersions"
import {
  getEmailTemplate,
  listEmailTemplates,
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
import type { EmailBodyBlock, PresetBlock } from "@/components/notifications/editor/emailBlocks"
import { BlockEditor } from "@/components/notifications/editor/BlockEditor"
import { EmailFooterEditor } from "@/components/notifications/editor/EmailFooterEditor"
import { VariableRichText } from "@/components/notifications/editor/VariableRichText"
import { EmailPreview } from "@/components/notifications/editor/EmailPreview"
import { ColorPicker } from "@/components/notifications/editor/ColorPicker"
import { useNotificationTypes } from "@/components/notifications/templateTypes"
import { notifTypeLabel } from "@/utils/notifType"
import { SelectMenu } from "@/components/ui/select-menu"
import { StatusPill } from "@/components/notifications/StatusPill"
import { statusLabelKey } from "@/lib/templateStatus"
import { useRole } from "@/lib/useRole"
import { sameTemplateValue } from "@/lib/templateEditorState"
import { FieldHelp } from "@/components/ui/field-help"
import { toast } from "@/components/ui/toast"

// ── Detail inner component (needs Suspense for useSearchParams) ───────────────

function Detail({ id, initialType = "" }: { id: string; initialType?: string }) {
  const router = useRouter()
  const canWrite = useRole().can("notifications.templates.write")

  // ── Remote state ──────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [versionRevision, setVersionRevision] = useState(0)

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
  const [notificationType, setNotificationType] = useState(initialType)
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [body, setBody] = useState<EmailBodyBlock[]>([])
  const [styling, setStyling] = useState<Record<string, unknown>>({})
  const footer = body.find((block): block is PresetBlock => block.type === "preset" && block.placement === "footer")
  const bodyContent = body.filter((block) => !(block.type === "preset" && block.placement === "footer"))

  function setBodyContent(blocks: EmailBodyBlock[]) {
    setBody(footer ? [...blocks, footer] : blocks)
  }

  function setFooter(id: string) {
    const selected = presets.find((preset) => preset.ID === id)
    setBody(selected ? [...bodyContent, { type: "preset", preset_id: selected.ID, name: selected.Name, placement: "footer" }] : bodyContent)
  }

  // ── Presets ───────────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<BlockPreset[]>([])

  // ── Notification type catalog ─────────────────────────────────────────────
  const notifTypes = useNotificationTypes()

  // ── Load template (once, on id change) ───────────────────────────────────
  const load = useCallback(() => {
    if (!id) {
      // New template — nothing to fetch, just show blank form
      return
    }
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
    return entry.Variables.map((v) => ({ name: v.Name, description: v.Description, example: v.Default }))
  }, [notifTypes, notificationType])

  // ── Styling helpers ───────────────────────────────────────────────────────
  function setStylingKey(key: string, val: unknown) {
    setStyling((prev) => ({ ...prev, [key]: val }))
  }

  const ctaBgColor    = (styling.cta_bg_color     as string  | undefined) ?? "theme:accent"
  const ctaTextColor  = (styling.cta_text_color   as string  | undefined) ?? "theme:on_accent"
  const textColor     = (styling.text_color        as string  | undefined) ?? "#333333"
  const headingColor  = (styling.heading_color     as string  | undefined) ?? "theme:brand"
  const ctaBorderRadius = parseInt(String(styling.cta_border_radius ?? '4px'), 10) || 0
  const ctaFontSize   = parseInt(String(styling.cta_font_size ?? '14px'), 10) || 14

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (busy || !isDirty || !notificationType) return
    setBusy(true)
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
        setVersionRevision((value) => value + 1)
        router.replace(`/notifications/templates/email/detail?id=${created.ID}`)
        toast.success("Шаблон створено.")
      } else {
        // Update existing draft
        const updated = await updateEmailTemplate(template.ID, {
          Subject: subject,
          Preheader: preheader,
          Body: body,
          Styling: styling,
        })
        setTemplate(updated)
        setVersionRevision((value) => value + 1)
        toast.success("Шаблон збережено.")
      }
    } catch {
      toast.error(t("admin.notif.tpl.saveError"))
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!template || template.Status !== "draft" || isDirty || busy) return
    setBusy(true)
    try {
      const updated = await publishEmailTemplate(template.ID)
      setTemplate(updated)
      setVersionRevision((value) => value + 1)
      toast.success("Шаблон опубліковано.")
    } catch {
      toast.error(t("admin.notif.tpl.saveError"))
    } finally {
      setBusy(false)
    }
  }

  async function handleRollback(sourceId: string): Promise<boolean> {
    if (!template) return false
    setBusy(true)
    try {
      const updated = await rollbackEmailTemplate(sourceId)
      setTemplate(updated)
      setVersionRevision((value) => value + 1)
      // Re-sync form state from the rolled-back template
      setSubject(updated.Subject)
      setPreheader(updated.Preheader)
      setBody(updated.Body)
      setStyling(updated.Styling)
      setLoadNonce((n) => n + 1)
      router.replace(`/notifications/templates/email/detail?id=${updated.ID}`)
      toast.success("Версію шаблону відновлено.")
      return true
    } catch {
      toast.error(t("admin.notif.tpl.saveError"))
      return false
    } finally {
      setBusy(false)
    }
  }

  // handleEdit is the non-destructive edit entry for a published/unpublished
  // template: open this type's draft, creating a copy of the current content if
  // no draft exists yet. The published version stays live until the draft is
  // published — unlike Rollback, which takes it offline.
  async function handleEdit() {
    if (!template) return
    setBusy(true)
    try {
      const existing = await listEmailTemplates({ type: template.NotificationType, status: "draft" })
      const draft = existing.Templates[0] ?? await createEmailTemplate({
        NotificationType: template.NotificationType,
        Subject: subject,
        Preheader: preheader,
        Body: body,
        Styling: styling,
      })
      router.replace(`/notifications/templates/email/detail?id=${draft.ID}`)
      toast.success("Чернетку відкрито для редагування.")
    } catch {
      toast.error(t("admin.notif.tpl.saveError"))
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePreset(blocks: EmailBodyBlock[], name: string) {
    await createBlockPreset({ Name: name, Description: "", Blocks: blocks })
    const fresh = await listBlockPresets()
    setPresets(fresh)
    toast.success("Спільний блок збережено.")
  }

  async function handleCreateFooter(name: string, blocks: EmailBodyBlock[]) {
    const created = await createBlockPreset({ Name: name, Description: "Email footer", Blocks: blocks })
    setPresets((current) => [...current, created])
    setBody([...bodyContent, { type: "preset", preset_id: created.ID, name: created.Name, placement: "footer" }])
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />
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
        <EmptyState message={t("admin.notif.tpl.empty")} />
      </div>
    )
  }

  const isNew      = !template?.ID
  const isReadOnly = !canWrite || template?.Status === "published" || template?.Status === "unpublished"
  const isDraft    = template?.Status === "draft"
  const isDirty = template
    ? subject !== template.Subject || preheader !== template.Preheader
      || !sameTemplateValue(body, template.Body) || !sameTemplateValue(styling, template.Styling)
    : Boolean(notificationType)

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
          {template !== null && canWrite && (
            <Button variant="outline" onClick={() => setTestOpen(true)}>
              <Send className="h-4 w-4 mr-1" />
              {t("admin.notif.test.button")}
            </Button>
          )}
          {/* Save becomes the primary action only when there are local changes. */}
          {!isReadOnly && (
            <Button variant={isDirty ? "default" : "outline"} onClick={() => void handleSave()} disabled={busy || !isDirty || !notificationType}>
              {t("admin.notif.tpl.save")}
            </Button>
          )}
          {/* Only a saved draft can be published. */}
          {isDraft && !isDirty && canWrite && (
            <Button variant="outline" onClick={() => void handlePublish()} disabled={busy}>
              {t("admin.notif.tpl.publish")}
            </Button>
          )}
          {/* Edit: published/unpublished → open (or create) the type's draft */}
          {canWrite && isReadOnly && (
            <Button onClick={() => void handleEdit()} disabled={busy}>
              {t("admin.notif.tpl.edit")}
            </Button>
          )}
        </div>
      </div>

      {template && <TemplateVersions channel="email" notificationType={template.NotificationType} currentId={template.ID}
        canWrite={canWrite} dirty={isDirty} busy={busy} refreshKey={versionRevision} onRestore={handleRollback} />}

      {/* ── Type selector (new template only) ── */}
      {isNew && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-foreground">
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,45%)]">

        {/* ── Left column: editor fields ── */}
        <div className="space-y-5 min-w-0">


          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
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
            <label className="mb-1 block text-sm font-medium text-foreground">
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
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t("admin.notif.tpl.body")}
            </label>
            {isReadOnly ? (
              <div
                data-testid="body-readonly"
                className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground"
              >
                {t("admin.notif.tpl.readonlyHint")}
              </div>
            ) : (
              <BlockEditor
                key={`body-${loadNonce}`}
                value={bodyContent}
                onChange={setBodyContent}
                variables={emailVariables}
                presets={presets}
                onSavePreset={handleSavePreset}
              />
            )}
          </div>

          <EmailFooterEditor presetId={footer?.preset_id ?? ""} presets={presets} variables={emailVariables}
            readOnly={isReadOnly} onSelect={setFooter} onCreate={handleCreateFooter} />

          {/* Styling */}
          <div>
            <div className="mb-3 flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">{t("admin.notif.tpl.styling")}</span>
              <FieldHelp text={t("admin.notif.editor.advancedStylingHelp")} />
            </div>
            <div
              data-testid="styling-wrapper"
              {...(isReadOnly ? { inert: true } : {})}
              className={`grid grid-cols-2 gap-4${isReadOnly ? " opacity-60" : ""}`}
            >
              <ColorPicker
                label={t("admin.notif.editor.ctaBackground")}
                value={ctaBgColor}
                onChange={(v) => setStylingKey("cta_bg_color", v)}
              />
              <ColorPicker
                label={t("admin.notif.editor.ctaText")}
                value={ctaTextColor}
                onChange={(v) => setStylingKey("cta_text_color", v)}
              />
              <ColorPicker
                label={t("admin.notif.editor.textColor")}
                value={textColor}
                onChange={(v) => setStylingKey("text_color", v)}
              />
              <ColorPicker
                label={t("admin.notif.editor.headingColor")}
                value={headingColor}
                onChange={(v) => setStylingKey("heading_color", v)}
              />
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("admin.notif.editor.ctaBorderRadius")}
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
                  aria-label={t("admin.notif.editor.ctaBorderRadius")}
                  className="w-20 rounded-md border border-border bg-secondary/40 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("admin.notif.editor.ctaFontSize")}
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
                  aria-label={t("admin.notif.editor.ctaFontSize")}
                  className="w-20 rounded-md border border-border bg-secondary/40 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                />
              </label>
              <details className="col-span-2 rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">{t("admin.notif.editor.advancedStyling")}</summary>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {t("admin.notif.editor.fontFamily")}
                    <select value={String(styling.font_family ?? "sans-serif")} onChange={(e) => setStylingKey("font_family", e.target.value)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground">
                      <option value="sans-serif">Sans-serif</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                    </select>
                  </label>
                  {([
                    ["text_font_size", "admin.notif.editor.textFontSize", "14px", 8, 32, "px"],
                    ["text_line_height", "admin.notif.editor.textLineHeight", "1.5", 1, 3, ""],
                    ["heading_line_height", "admin.notif.editor.headingLineHeight", "1.3", 1, 3, ""],
                    ["paragraph_bottom_margin", "admin.notif.editor.paragraphSpacing", "12px", 0, 64, "px"],
                    ["heading_top_margin", "admin.notif.editor.headingTopSpacing", "16px", 0, 64, "px"],
                    ["heading_bottom_margin", "admin.notif.editor.headingBottomSpacing", "8px", 0, 64, "px"],
                    ["cta_vertical_padding", "admin.notif.editor.buttonVerticalPadding", "10px", 0, 48, "px"],
                    ["cta_horizontal_padding", "admin.notif.editor.buttonHorizontalPadding", "20px", 0, 80, "px"],
                  ] as const).map(([key, label, fallback, min, max, unit]) =>
                    <label key={key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      {t(label)}
                      <input type="number" min={min} max={max} step={unit ? 1 : 0.1}
                        value={parseFloat(String(styling[key] ?? fallback))}
                        onChange={(e) => setStylingKey(key, `${e.target.value}${unit}`)}
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground" />
                    </label>,
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* ── Right column: live email preview ── */}
        <div className="min-w-0">
          <div className="mb-2 text-sm font-semibold text-foreground">
            {t("admin.notif.editor.previewTitle")}
          </div>
          <div className="sticky top-4">
            <EmailPreview
              notificationType={notificationType}
              subject={subject}
              preheader={preheader}
              body={body}
              styling={styling}
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

function RouteDetail() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  const initialType = params.get("type") ?? ""
  return <Detail key={`${id}:${initialType}`} id={id} initialType={initialType} />
}

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
          <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />
        }
      >
        <RouteDetail />
      </Suspense>
    </RequirePermission>
  )
}
