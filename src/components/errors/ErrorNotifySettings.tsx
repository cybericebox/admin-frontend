"use client"
import { useEffect, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import {
  getErrorSettings, saveErrorSettings, sendErrorTest,
  MAX_NOTIFY_CHATS, MAX_NOTIFY_EMAILS, type ErrorSettings, type TestResult,
} from "@/api/errorJournal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { t } from "@/i18n/t"
import { errorOr } from "@/i18n/apiError"
import { formatDateTime } from "@/lib/locale"
import { validateSettings } from "@/lib/errorJournal"
import { useRole } from "@/lib/useRole"

type Draft = { emails: string[]; toSuperAdmins: boolean; chats: { chatID: string; label: string }[] }

const draftOf = (settings: ErrorSettings): Draft => ({
  emails: settings.Emails, toSuperAdmins: settings.EmailToSuperAdmins,
  chats: settings.TelegramChats.map((chat) => ({ chatID: chat.ChatID, label: chat.Label })),
})
const clean = (draft: Draft): Draft => ({
  ...draft,
  emails: draft.emails.map((value) => value.trim()).filter(Boolean),
  chats: draft.chats.map((chat) => ({ chatID: chat.chatID.trim(), label: chat.label.trim() })).filter((chat) => chat.chatID),
})

export function ErrorNotifySettings() {
  const writable = useRole().can("platform.errors.write")
  const [settings, setSettings] = useState<ErrorSettings | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResult[] | null>(null)

  useEffect(() => {
    let active = true
    getErrorSettings()
      .then((value) => { if (active) { setSettings(value); setDraft((current) => current ?? draftOf(value)); setFailure(null) } })
      .catch((cause) => { if (active) setFailure(cause ?? new Error("failed")) })
    return () => { active = false }
  }, [reload])

  const cleaned = useMemo(() => (draft ? clean(draft) : null), [draft])
  const issues = useMemo(() => (cleaned ? validateSettings({ emails: cleaned.emails, chats: cleaned.chats }) : []), [cleaned])
  const dirty = !!(settings && cleaned) && JSON.stringify(cleaned) !== JSON.stringify(clean(draftOf(settings)))

  if (!settings || !draft) {
    return failure ? <LoadError message={t("admin.errors.settings.loadError")} error={failure} onRetry={() => setReload((value) => value + 1)} className="min-h-80" />
      : <LoadingArea className="min-h-80" label={t("admin.loading")} />
  }

  const set = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setSaveError("") }
  const failing = new Map(settings.TelegramChats.map((chat) => [chat.ChatID, chat]))

  async function save() {
    if (!cleaned || issues.length) return
    setSaving(true)
    setSaveError("")
    try {
      const saved = await saveErrorSettings({ Emails: cleaned.emails, EmailToSuperAdmins: cleaned.toSuperAdmins, TelegramChats: cleaned.chats.map((chat) => ({ ChatID: chat.chatID, Label: chat.label })) })
      setSettings(saved)
      setDraft(draftOf(saved))
      toast.success(t("admin.errors.settings.saved"))
    } catch (cause) {
      setSaveError(errorOr(cause, t("admin.errors.settings.saveError")))
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    try {
      setResults(await sendErrorTest())
      // The server updates the failing marks of the chats: pick them up without touching the draft.
      getErrorSettings().then(setSettings).catch(() => undefined)
    } catch (cause) {
      toast.error(errorOr(cause, t("admin.errors.settings.testError")))
    } finally {
      setTesting(false)
    }
  }

  const issuesOf = (field: "emails" | "chats") => issues.filter((issue) => issue.field === field)

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("admin.errors.settings.intro")}</p>

      <section aria-labelledby="errors-emails" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 id="errors-emails" className="text-sm font-semibold text-foreground">{t("admin.errors.settings.emails")}</h3>
        <label className="flex items-center gap-3 text-sm text-foreground">
          <Switch checked={draft.toSuperAdmins} disabled={!writable} onCheckedChange={(value) => set({ toSuperAdmins: value })} aria-label={t("admin.errors.settings.toSuperAdmins")} />
          {t("admin.errors.settings.toSuperAdmins")}
        </label>
        {draft.emails.map((email, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input type="email" value={email} disabled={!writable} onChange={(event) => set({ emails: draft.emails.map((value, at) => at === index ? event.target.value : value) })} aria-label={t("admin.errors.settings.emailN", { n: index + 1 })} placeholder={t("admin.errors.settings.emailPlaceholder")} />
            {writable && <Button type="button" variant="outline" size="sm" aria-label={t("admin.errors.settings.removeEmail", { value: email || String(index + 1) })} onClick={() => set({ emails: draft.emails.filter((_, at) => at !== index) })}><X aria-hidden="true" className="h-4 w-4" /></Button>}
          </div>
        ))}
        {draft.emails.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.errors.settings.noEmails")}</p>}
        {issuesOf("emails").map((issue, index) => <p key={index} role="alert" className="text-sm text-destructive">{t(issue.key, issue.vars)}</p>)}
        {writable && <Button type="button" variant="outline" size="sm" disabled={draft.emails.length >= MAX_NOTIFY_EMAILS} onClick={() => set({ emails: [...draft.emails, ""] })}><Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />{t("admin.errors.settings.addEmail")}</Button>}
      </section>

      <section aria-labelledby="errors-telegram" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 id="errors-telegram" className="text-sm font-semibold text-foreground">{t("admin.errors.settings.telegram")}</h3>
        {!settings.TelegramEnabled && <p role="status" className="rounded-md bg-[var(--ib-warn-bg)] p-3 text-sm text-[var(--ib-warn)]">{t("admin.errors.settings.telegramOff")}</p>}
        <p className="text-sm text-muted-foreground">{t("admin.errors.settings.telegramHelp")}</p>
        {draft.chats.map((chat, index) => {
          const state = failing.get(chat.chatID.trim())
          return (
            <div key={index} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Input value={chat.chatID} disabled={!writable} onChange={(event) => set({ chats: draft.chats.map((value, at) => at === index ? { ...value, chatID: event.target.value } : value) })} aria-label={t("admin.errors.settings.chatIDN", { n: index + 1 })} placeholder={t("admin.errors.settings.chatIDPlaceholder")} className="w-56 font-mono" />
                <Input value={chat.label} disabled={!writable} onChange={(event) => set({ chats: draft.chats.map((value, at) => at === index ? { ...value, label: event.target.value } : value) })} aria-label={t("admin.errors.settings.chatLabelN", { n: index + 1 })} placeholder={t("admin.errors.settings.chatLabelPlaceholder")} className="min-w-40 flex-1" />
                {writable && <Button type="button" variant="outline" size="sm" aria-label={t("admin.errors.settings.removeChat", { value: chat.chatID || String(index + 1) })} onClick={() => set({ chats: draft.chats.filter((_, at) => at !== index) })}><X aria-hidden="true" className="h-4 w-4" /></Button>}
              </div>
              {state?.Failing && <p className="text-xs text-destructive">{t("admin.errors.settings.chatFailing", { since: formatDateTime(state.FailingSince) })}{state.LastError ? `: ${state.LastError}` : ""}</p>}
            </div>
          )
        })}
        {draft.chats.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.errors.settings.noChats")}</p>}
        {issuesOf("chats").map((issue, index) => <p key={index} role="alert" className="text-sm text-destructive">{t(issue.key, issue.vars)}</p>)}
        {writable && <Button type="button" variant="outline" size="sm" disabled={draft.chats.length >= MAX_NOTIFY_CHATS} onClick={() => set({ chats: [...draft.chats, { chatID: "", label: "" }] })}><Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />{t("admin.errors.settings.addChat")}</Button>}
      </section>

      {writable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void save()} busy={saving} disabled={!dirty || issues.length > 0}>{t("admin.errors.settings.save")}</Button>
          <Button type="button" variant="outline" onClick={() => void test()} busy={testing}>{t("admin.errors.settings.test")}</Button>
          {dirty && <span className="text-xs text-muted-foreground">{t("admin.errors.settings.testSavedOnly")}</span>}
          {saveError && <p role="alert" className="w-full text-sm text-destructive">{saveError}</p>}
        </div>
      )}

      {results && (
        <section aria-label={t("admin.errors.settings.results")} className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("admin.errors.settings.results")}</h3>
          {results.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.errors.settings.noTargets")}</p>}
          <ul className="space-y-1.5">
            {results.map((result, index) => (
              <li key={`${result.Channel}:${result.Target}:${index}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className={result.OK ? "font-medium text-[var(--ib-ok)]" : "font-medium text-[var(--ib-danger)]"}>{t(result.OK ? "admin.errors.settings.resultOk" : "admin.errors.settings.resultFailed")}</span>
                <span className="text-muted-foreground">{t(`admin.errors.settings.channel.${result.Channel}`)}</span>
                <span className="font-mono text-foreground">{result.Label ? `${result.Label} (${result.Target})` : result.Target}</span>
                {!result.OK && result.Error && <span className="break-words text-muted-foreground">{result.Error}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
