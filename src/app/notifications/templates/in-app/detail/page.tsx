"use client"

/**
 * In-app notification template editor page.
 *
 * Route: /notifications/templates/in-app/detail?id=<uuid>
 * No dynamic [id] segment — compatible with Next.js static export.
 *
 * Layout:
 *   Left  — Title/Body/Link, semantic appearance, optional second action.
 *   Right — InAppPreview (live, fed from current form state)
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
import {
  getInAppTemplate,
  listInAppTemplates,
  createInAppTemplate,
  updateInAppTemplate,
  publishInAppTemplate,
  rollbackInAppTemplate,
} from "@/api/notifications/inAppTemplates"
import type { InAppTemplate, InAppAction } from "@/api/notifications/inAppTemplates"
import { VariableRichText } from "@/components/notifications/editor/VariableRichText"
import { InAppBodyEditor } from "@/components/notifications/editor/InAppBodyEditor"
import { InAppPreview } from "@/components/notifications/editor/InAppPreview"
import { NotificationAppearancePicker } from "@/components/notifications/editor/NotificationAppearancePicker"
import { useNotificationTypes } from "@/components/notifications/templateTypes"
import { notifTypeLabel } from "@/utils/notifType"
import { SelectMenu } from "@/components/ui/select-menu"
import { StatusPill } from "@/components/notifications/StatusPill"
import { statusLabelKey } from "@/lib/templateStatus"
import { useRole } from "@/lib/useRole"

// ── Detail inner component (needs Suspense for useSearchParams) ───────────────

function Detail({ id, initialType = "" }: { id: string; initialType?: string }) {
  const router = useRouter()
  const canWrite = useRole().can("notifications.templates.write")

  // ── Remote state ──────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<InAppTemplate | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [formError, setFormError] = useState(false)

  // ── Load nonce — incremented whenever we (re)populate form from server data ──
  // Changing this causes mount-initialized editors (VariableRichText) to remount
  // so they pick up the new initial value instead of showing stale content.
  const [loadNonce, setLoadNonce] = useState(0)

  // ── Test modal state ──────────────────────────────────────────────────────
  const [testOpen, setTestOpen] = useState(false)
  // Stable channels array — avoids TestNotificationModal re-seeding on every render
  const testChannels = useMemo(() => ["in_app"], [])

  // ── Form state (source of truth after first load) ─────────────────────────
  const [notificationType, setNotificationType] = useState(initialType)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [link, setLink] = useState("")
  const [icon, setIcon] = useState("bell")
  const [tone, setTone] = useState("neutral")
  const [accentColor, setAccentColor] = useState("")
  const [surface, setSurface] = useState("inbox")
  const [autoDismissMs, setAutoDismissMs] = useState<number | null>(null)
  const [dismissible, setDismissible] = useState(true)
  const [actions, setActions] = useState<InAppAction[]>([])

  // ── Notification type catalog ─────────────────────────────────────────────
  const notifTypes = useNotificationTypes()

  // ── Load template (once, on id change) ───────────────────────────────────
  const load = useCallback(() => {
    if (!id) {
      return
    }
    getInAppTemplate(id)
      .then((tpl) => {
        setTemplate(tpl)
        setNotificationType(tpl.NotificationType)
        setTitle(tpl.Title)
        setBody(tpl.Body)
        setLink(tpl.Link)
        setIcon(tpl.Icon)
        setTone(tpl.Tone)
        setAccentColor(tpl.AccentColor)
        setSurface(tpl.Surface)
        setAutoDismissMs(tpl.AutoDismissMs)
        setDismissible(tpl.Dismissible ?? true)
        setActions(tpl.Actions)
        setLoadNonce((n) => n + 1)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Derived: variables for in_app channel (for the current type) ──────────
  const inAppVariables = useMemo(() => {
    const entry = notifTypes.find((nt) => nt.Type === notificationType)
    if (!entry || !entry.Channels.includes("in_app")) return []
    return entry.Variables.map((v) => ({ name: v.Name, description: v.Description, example: v.Default }))
  }, [notifTypes, notificationType])

  // ── Derived: preview values (each variable's Default from catalog) ─────────
  const previewValues = useMemo(() => {
    const entry = notifTypes.find((nt) => nt.Type === notificationType)
    if (!entry) return {}
    return Object.fromEntries(entry.Variables.map((v) => [v.Name, v.Default]))
  }, [notifTypes, notificationType])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (actions.length > 1 || actions.some((action) => !action.label.trim() || !/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(action.href.trim()) || action.href.includes("{{"))) {
      setFormError(true)
      return
    }
    setFormError(false)
    setBusy(true)
    setSaveError(false)
    try {
      const payload = {
        Title:         title,
        Body:          body,
        Link:          link,
        Icon:          icon,
        Tone:          tone,
        AccentColor:   accentColor,
        Surface:       surface,
        AutoDismissMs: autoDismissMs,
        Dismissible:   dismissible,
        Actions:       actions,
      }
      if (!template?.ID) {
        // Create new
        const created = await createInAppTemplate({
          NotificationType: notificationType,
          ...payload,
        })
        setTemplate(created)
        router.replace(`/notifications/templates/in-app/detail?id=${created.ID}`)
      } else {
        // Update existing draft
        const updated = await updateInAppTemplate(template.ID, payload)
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
      const updated = await publishInAppTemplate(template.ID)
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
      const updated = await rollbackInAppTemplate(template.ID)
      setTemplate(updated)
      // Re-sync form state from the rolled-back template
      setTitle(updated.Title)
      setBody(updated.Body)
      setLink(updated.Link)
      setIcon(updated.Icon)
      setTone(updated.Tone)
      setAccentColor(updated.AccentColor)
      setSurface(updated.Surface)
      setAutoDismissMs(updated.AutoDismissMs)
      setDismissible(updated.Dismissible ?? true)
      setActions(updated.Actions)
      setLoadNonce((n) => n + 1)
      router.replace(`/notifications/templates/in-app/detail?id=${updated.ID}`)
    } catch {
      setSaveError(true)
    } finally {
      setBusy(false)
    }
  }

  // handleEdit opens this type's draft for a published/unpublished template,
  // creating a copy of the current content if no draft exists. The published
  // version stays live until the draft is published (unlike Rollback).
  async function handleEdit() {
    if (!template) return
    setBusy(true)
    setSaveError(false)
    try {
      const existing = await listInAppTemplates({ type: template.NotificationType, status: "draft" })
      const draft = existing.Templates[0] ?? await createInAppTemplate({
        NotificationType: template.NotificationType,
        Title:         title,
        Body:          body,
        Link:          link,
        Icon:          icon,
        Tone:          tone,
        AccentColor:   accentColor,
        Surface:       surface,
        AutoDismissMs: autoDismissMs,
        Dismissible:   dismissible,
        Actions:       actions,
      })
      router.replace(`/notifications/templates/in-app/detail?id=${draft.ID}`)
    } catch {
      setSaveError(true)
    } finally {
      setBusy(false)
    }
  }

  // ── Actions helpers ───────────────────────────────────────────────────────

  function addAction() {
    setActions((prev) => [...prev, { label: "", href: "" }])
  }

  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateAction(i: number, field: "label" | "href", value: string) {
    setActions((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    )
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <LoadingArea className="frost-panel frost-in rounded-lg" label={t("admin.loading")} />
    )
  }

  if (notFound) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8">
        <Link
          href="/notifications/templates/in-app"
          className="text-sm text-primary hover:underline"
        >
          ← {t("admin.notif.tpl.inapp")}
        </Link>
        <EmptyState message={t("admin.notif.tpl.empty")} />
      </div>
    )
  }

  const isNew      = !id || !template
  const isReadOnly = !canWrite || template?.Status === "published" || template?.Status === "unpublished"
  const isDraft    = template?.Status === "draft"

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="frost-panel frost-in rounded-lg p-6">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <Link
          href="/notifications/templates/in-app"
          className="text-sm text-primary hover:underline shrink-0"
        >
          ← {t("admin.notif.tpl.inapp")}
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
          {/* Save: shown when not read-only */}
          {!isReadOnly && (
            <Button onClick={() => void handleSave()} disabled={busy || !notificationType}>
              {t("admin.notif.tpl.save")}
            </Button>
          )}
          {/* Publish: shown for draft */}
          {isDraft && canWrite && (
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
          {/* Rollback: shown for published or unpublished */}
          {canWrite && template?.Status === "unpublished" && (
            <Button variant="outline" onClick={() => void handleRollback()} disabled={busy}>
              {t("admin.notif.tpl.rollback")}
            </Button>
          )}
          {saveError && (
            <span className="text-sm text-destructive">{t("admin.notif.tpl.saveError")}</span>
          )}
          {formError && <span className="text-sm text-destructive">{t("admin.notif.inapp.actionsInvalid")}</span>}
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
            ariaLabel={t("admin.notif.tpl.type")}
            placeholder={t("admin.notif.tpl.choose")}
            options={notifTypes
              .filter((nt) => nt.Channels.includes("in_app"))
              .map((nt) => ({ value: nt.Type, label: notifTypeLabel(nt.Type) }))}
          />
        </div>
      )}

      {/* ── Two-column editor layout ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,42%)]">

        {/* ── Left column: editor fields ── */}
        <div className="space-y-5 min-w-0">


          {/* Editable fields wrapper — inert when read-only */}
          <div
            data-testid="fields-wrapper"
            {...(isReadOnly ? { inert: true } : {})}
            className={isReadOnly ? "opacity-60 space-y-5" : "space-y-5"}
          >

            {/* Title */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                {t("admin.notif.tpl.title")}
              </label>
              <VariableRichText
                key={`title-${loadNonce}`}
                value={title}
                onChange={setTitle}
                variables={inAppVariables}
                placeholder={t("admin.notif.tpl.title")}
                dotted
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                {t("admin.notif.tpl.body")}
              </label>
              <InAppBodyEditor
                key={`body-${loadNonce}`}
                value={body}
                onChange={setBody}
                variables={inAppVariables}
                disabled={isReadOnly}
              />
            </div>

            {/* Link */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                {t("admin.notif.tpl.link")}
              </label>
              <VariableRichText
                key={`link-${loadNonce}`}
                value={link}
                onChange={setLink}
                variables={inAppVariables}
                placeholder={t("admin.notif.tpl.link")}
                dotted
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("admin.notif.inapp.linkHelp")}</p>
            </div>

            <NotificationAppearancePicker icon={icon} tone={tone} accentColor={accentColor}
              onChange={(next) => { setIcon(next.icon); setTone(next.tone); setAccentColor(next.accentColor) }} />

            <p className="text-xs text-muted-foreground">{t("admin.notif.inapp.deliveryHint")}</p>
            {surface !== "inbox" && <p className="text-xs text-amber-700 dark:text-amber-400">{t("admin.notif.inapp.legacySurface")}</p>}

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                  {t("admin.notif.inapp.actions")}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addAction}
                  type="button"
                  disabled={actions.length >= 1}
                >
                  {t("admin.notif.inapp.addAction")}
                </Button>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{t("admin.notif.inapp.actionsHelp")}</p>
              <div className="space-y-2">
                {actions.map((action, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={action.label}
                      onChange={(e) => updateAction(i, "label", e.target.value)}
                      placeholder={t("admin.notif.inapp.actionLabel")}
                      aria-label={`${t("admin.notif.inapp.actionLabel")} ${i + 1}`}
                      className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={action.href}
                      onChange={(e) => updateAction(i, "href", e.target.value)}
                      placeholder={t("admin.notif.inapp.actionHref")}
                      aria-label={`${t("admin.notif.inapp.actionHref")} ${i + 1}`}
                      className="flex-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeAction(i)}
                      type="button"
                    >
                      {t("admin.notif.inapp.removeAction")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Right column: live in-app preview ── */}
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.notif.editor.previewInApp")}
          </div>
          <div className="sticky top-4">
            <InAppPreview
              title={title}
              body={body}
              link={link}
              icon={icon}
              tone={tone}
              accentColor={accentColor}
              surface={surface}
              autoDismissMs={autoDismissMs}
              actions={actions}
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
          <LoadingArea className="frost-panel frost-in rounded-lg" label={t("admin.loading")} />
        }
      >
        <RouteDetail />
      </Suspense>
    </RequirePermission>
  )
}
