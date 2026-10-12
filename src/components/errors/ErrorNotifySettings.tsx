"use client"
import { useEffect, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import {
  getErrorSettings, saveErrorSettings, sendErrorTest,
  MAX_NOTIFY_CHATS, MAX_NOTIFY_EMAILS, type ErrorSettings, type TestResult,
} from "@/api/errorJournal"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { useSavedDraft } from "@/lib/useSavedDraft"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { UserPicker, type PickedUser } from "@/components/notifications/broadcast/UserPicker"
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
const normalizedDraft = (draft: Draft | null) => draft ? clean(draft) : null
const emailsOf = (users: PickedUser[]) => {
  const seen = new Set<string>()
  return users.map((user) => user.email.trim()).filter((email) => {
    if (!email || seen.has(email.toLowerCase())) return false
    seen.add(email.toLowerCase())
    return true
  })
}

export function ErrorNotifySettings() {
  const { can } = useRole()
  const writable = can("platform.errors.write")
  const canReadUsers = can("users.read")
  const [settings, setSettings] = useState<ErrorSettings | null>(null)
  const { draft, setDraft, dirty, accept } = useSavedDraft(settings ? draftOf(settings) : null, normalizedDraft)
  const [failure, setFailure] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResult[] | null>(null)

  useEffect(() => {
    let active = true
    getErrorSettings()
      .then((value) => { if (active) { setSettings(value); setFailure(null) } })
      .catch((cause) => { if (active) setFailure(cause ?? new Error("failed")) })
    return () => { active = false }
  }, [reload])

  const cleaned = useMemo(() => (draft ? clean(draft) : null), [draft])
  const issues = useMemo(() => (cleaned ? validateSettings({ emails: cleaned.emails, chats: cleaned.chats }) : []), [cleaned])

  if (!settings || !draft) {
    return failure ? <LoadError message={t("admin.errors.settings.loadError")} error={failure} onRetry={() => setReload((value) => value + 1)} className="min-h-80" />
      : <LoadingArea className="min-h-80" label={t("admin.loading")} />
  }

  const set = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setSaveError("") }
  const failing = new Map(settings.TelegramChats.map((chat) => [chat.ChatID, chat]))

  async function save() {
    if (!writable || saving || !dirty || !cleaned || issues.length) return
    setSaving(true)
    setSaveError("")
    try {
      const saved = await saveErrorSettings({ Emails: cleaned.emails, EmailToSuperAdmins: cleaned.toSuperAdmins, TelegramChats: cleaned.chats.map((chat) => ({ ChatID: chat.chatID, Label: chat.label })) })
      setSettings(saved)
      accept(draftOf(saved), cleaned)
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
    <div className="flex w-full min-w-0 max-w-3xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("admin.errors.settings.intro")}</p>

      <section aria-labelledby="errors-emails" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 id="errors-emails" className="text-sm font-semibold text-foreground">{t("admin.errors.settings.emails")}</h3>
        <label className="flex items-center gap-3 text-sm text-foreground">
          <Switch checked={draft.toSuperAdmins} disabled={!writable} onCheckedChange={(value) => set({ toSuperAdmins: value })} aria-label={t("admin.errors.settings.toSuperAdmins")} />
          {t("admin.errors.settings.toSuperAdmins")}
        </label>
        {writable && canReadUsers && <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-foreground">{t("admin.errors.settings.registeredUsers")}</h4>
            <p className="text-sm text-muted-foreground">{t("admin.errors.settings.registeredUsersHelp")}</p>
          </div>
          <UserPicker selection="email" showSelected={false} maxSelected={MAX_NOTIFY_EMAILS}
            value={draft.emails.filter((email) => email.trim()).map((email) => ({ id: email, name: email, email }))}
            onChange={(users) => set({ emails: emailsOf(users) })} />
        </div>}
        <div className="space-y-1 border-t border-border pt-4">
          <h4 className="text-sm font-medium text-foreground">{t("admin.errors.settings.recipients")}</h4>
          <p className="text-sm text-muted-foreground">{t("admin.errors.settings.recipientsHelp")}</p>
        </div>
        {draft.emails.map((email, index) => (
          <div key={index} className="flex min-w-0 items-center gap-2">
            <Input type="email" className="min-w-0" value={email} disabled={!writable} onChange={(event) => set({ emails: draft.emails.map((value, at) => at === index ? event.target.value : value) })} aria-label={t("admin.errors.settings.emailN", { n: index + 1 })} placeholder={t("admin.errors.settings.emailPlaceholder")} />
            {writable && <Button type="button" variant="outline" size="icon" aria-label={t("admin.errors.settings.removeEmail", { value: email || String(index + 1) })} onClick={() => set({ emails: draft.emails.filter((_, at) => at !== index) })}><X aria-hidden="true" className="h-4 w-4" /></Button>}
          </div>
        ))}
        {draft.emails.length === 0 && <EmptyState compact message={t("admin.errors.settings.noEmails")} />}
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
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[14rem_minmax(0,1fr)_auto]">
                <Input value={chat.chatID} disabled={!writable} onChange={(event) => set({ chats: draft.chats.map((value, at) => at === index ? { ...value, chatID: event.target.value } : value) })} aria-label={t("admin.errors.settings.chatIDN", { n: index + 1 })} placeholder={t("admin.errors.settings.chatIDPlaceholder")} className="col-start-1 min-w-0 font-mono" />
                <Input value={chat.label} disabled={!writable} onChange={(event) => set({ chats: draft.chats.map((value, at) => at === index ? { ...value, label: event.target.value } : value) })} aria-label={t("admin.errors.settings.chatLabelN", { n: index + 1 })} placeholder={t("admin.errors.settings.chatLabelPlaceholder")} className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1" />
                {writable && <Button type="button" variant="outline" size="icon" className="col-start-2 row-start-1 sm:col-start-3" aria-label={t("admin.errors.settings.removeChat", { value: chat.chatID || String(index + 1) })} onClick={() => set({ chats: draft.chats.filter((_, at) => at !== index) })}><X aria-hidden="true" className="h-4 w-4" /></Button>}
              </div>
              {state?.Failing && <p className="text-xs text-destructive [overflow-wrap:anywhere]">{t(state.LastError ? "admin.errors.settings.chatFailingDetails" : "admin.errors.settings.chatFailing", { since: formatDateTime(state.FailingSince), reason: state.LastError })}</p>}
            </div>
          )
        })}
        {draft.chats.length === 0 && <EmptyState compact message={t("admin.errors.settings.noChats")} />}
        {issuesOf("chats").map((issue, index) => <p key={index} role="alert" className="text-sm text-destructive">{t(issue.key, issue.vars)}</p>)}
        {writable && <Button type="button" variant="outline" size="sm" disabled={draft.chats.length >= MAX_NOTIFY_CHATS} onClick={() => set({ chats: [...draft.chats, { chatID: "", label: "" }] })}><Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />{t("admin.errors.settings.addChat")}</Button>}
      </section>

      {writable && (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SaveButton type="button" onClick={() => void save()} dirty={dirty} busy={saving} disabled={issues.length > 0}>{t("admin.errors.settings.save")}</SaveButton>
            <Button type="button" variant="outline" onClick={() => void test()} busy={testing}>{t("admin.errors.settings.test")}</Button>
          </div>
          {dirty && <p className="text-xs text-muted-foreground">{t("admin.errors.settings.testSavedOnly")}</p>}
          {saveError && <p role="alert" className="w-full text-sm text-destructive">{saveError}</p>}
        </div>
      )}

      {results && (
        <section aria-label={t("admin.errors.settings.results")} className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4" aria-live="polite">
          <h3 className="text-sm font-semibold text-foreground">{t("admin.errors.settings.results")}</h3>
          {results.length === 0 && <EmptyState compact message={t("admin.errors.settings.noTargets")} />}
          <ul className="space-y-3">
            {results.map((result, index) => (
              <li key={`${result.Channel}:${result.Target}:${index}`} className="grid min-w-0 gap-1.5 border-t border-border pt-3 text-sm first:border-t-0 first:pt-0 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-3">
                <span className={result.OK ? "font-medium text-[var(--ib-ok)]" : "font-medium text-[var(--ib-danger)]"}>{t(result.OK ? "admin.errors.settings.resultOk" : "admin.errors.settings.resultFailed")}</span>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">{t(`admin.errors.settings.channel.${result.Channel}`)}</p>
                  <p className="text-foreground [overflow-wrap:anywhere]">{result.Label ? t("admin.errors.settings.resultTarget", { label: result.Label, target: result.Target }) : result.Target}</p>
                  {!result.OK && result.Error && <p className="text-muted-foreground [overflow-wrap:anywhere]">{result.Error}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
