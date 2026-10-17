"use client"
import { useRef, useState } from "react"
import {
  REGISTRY_PROVIDERS, clearImageRegistrySettings, listImageRegistryRepositories, registryFailure, saveImageRegistrySettings,
  type ImageRegistrySettings, type RegistryProvider,
} from "@/api/imageRegistry/settings"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { FieldHelp } from "@/components/ui/field-help"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { SaveButton } from "@/components/ui/save-button"
import { SelectMenu } from "@/components/ui/select-menu"
import { toast } from "@/components/ui/toast"

const KNOWN_REASONS = ["unauthorized", "unreachable", "rate_limited", "not_found"]

/** The inline text of a failed call: the translated registry reason when the server names one, else the catalog message. */
function failureText(err: unknown): string {
  const failure = registryFailure(err)
  if (!failure) return localizedError(err)
  const reason = t(`admin.imageRegistry.reason.${KNOWN_REASONS.includes(failure.reason) ? failure.reason : "other"}`)
  return failure.token ? t("admin.imageRegistry.failedToken", { reason, token: t(`admin.imageRegistry.token.${failure.token}`) }) : t("admin.imageRegistry.failed", { reason })
}

function Field({ id, label, help, children }: { id?: string; label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="block text-sm font-medium">{label}</label>
        {help && <FieldHelp text={help} />}
      </div>
      {children}
    </div>
  )
}

/**
 * The platform image registry: provider, account, write-only tokens and the repository picked from the list
 * the token can see (no free typing). The save busies only its own button; tokens are never shown back.
 */
export function ImageRegistryCard({ settings, canWrite, onChange }: {
  settings: ImageRegistrySettings
  canWrite: boolean
  onChange: (next: ImageRegistrySettings) => void
}) {
  const [provider, setProvider] = useState<RegistryProvider>(settings.Provider || "dockerhub")
  const [account, setAccount] = useState(settings.Account)
  const [pushToken, setPushToken] = useState("")
  const [pullToken, setPullToken] = useState("")
  const [clearPull, setClearPull] = useState(false)
  const [repository, setRepository] = useState(settings.Repository)
  const [repositories, setRepositories] = useState<string[] | null>(null)
  const [listBusy, setListBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectBusy, setDisconnectBusy] = useState(false)
  const [disconnectError, setDisconnectError] = useState("")
  const edits = useRef(0)
  // Bumped when the provider or account changes: a repository list requested before it is stale.
  const target = useRef(0)

  const disabled = !canWrite
  const account_ = account.trim()
  const sameAccount = provider === settings.Provider && account_.toLowerCase() === settings.Account.toLowerCase()
  const dirty = provider !== (settings.Provider || "dockerhub") || account_ !== settings.Account || repository !== settings.Repository
    || pushToken !== "" || pullToken !== "" || clearPull
  // A new provider account has no stored token to reuse: a token must be typed.
  const canSave = !settings.SecretsKeyMissing && !!account_ && !!repository && (pushToken !== "" || (sameAccount && settings.PushTokenSet))
  const repoOptions = (repositories ?? (settings.Repository ? [settings.Repository] : [])).map((value) => ({ value, label: value }))
  if (repository && !repoOptions.some((o) => o.value === repository)) repoOptions.unshift({ value: repository, label: repository })

  function edit(apply: () => void, resetRepository = false) {
    edits.current += 1
    apply()
    setError("")
    setInfo("")
    if (resetRepository) { target.current += 1; setRepositories(null); setRepository(""); setClearPull(false) }
  }

  async function list() {
    if (listBusy) return
    setListBusy(true)
    setError("")
    setInfo("")
    const generation = target.current
    try {
      const found = await listImageRegistryRepositories({ Provider: provider, Account: account_, Token: pushToken })
      if (generation !== target.current) return
      setRepositories(found)
      if (found.length === 0) setInfo(t("admin.imageRegistry.noRepositories"))
      else if (repository && !found.includes(repository)) setRepository("")
    } catch (err) {
      if (generation === target.current) setError(failureText(err))
    } finally {
      setListBusy(false)
    }
  }

  async function save() {
    if (saveBusy || !dirty || !canSave) return
    setSaveBusy(true)
    setError("")
    const seen = edits.current
    try {
      const next = await saveImageRegistrySettings({
        Provider: provider, Account: account_, Repository: repository,
        PushToken: pushToken, PullToken: clearPull ? "" : pullToken, ClearPullToken: clearPull,
      })
      onChange(next)
      // Typed tokens are dropped after saving, unless the admin kept typing meanwhile.
      if (edits.current === seen) { setPushToken(""); setPullToken(""); setClearPull(false); setAccount(next.Account); setRepository(next.Repository) }
      toast.success(t("admin.imageRegistry.saved"))
    } catch (err) {
      setError(failureText(err))
    } finally {
      setSaveBusy(false)
    }
  }

  async function disconnect() {
    setDisconnectBusy(true)
    setDisconnectError("")
    try {
      const next = await clearImageRegistrySettings()
      onChange(next)
      setDisconnecting(false)
      setProvider("dockerhub"); setAccount(""); setPushToken(""); setPullToken(""); setClearPull(false); setRepository(""); setRepositories(null)
      toast.success(t("admin.imageRegistry.disconnected"))
    } catch (err) {
      setDisconnectError(failureText(err))
    } finally {
      setDisconnectBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("admin.imageRegistry.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {settings.SecretsKeyMissing && <Alert variant="warning">{t("admin.imageRegistry.secretsKeyMissing")}</Alert>}
        <p className="text-sm text-muted-foreground">{t("admin.imageRegistry.note")}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("admin.imageRegistry.provider")}>
            <SelectMenu
              ariaLabel={t("admin.imageRegistry.provider")}
              className="w-full"
              value={provider}
              disabled={disabled}
              options={REGISTRY_PROVIDERS.map((value) => ({ value, label: t(`admin.imageRegistry.provider.${value}`) }))}
              onChange={(value) => edit(() => setProvider(value as RegistryProvider), true)}
            />
          </Field>
          <Field id="registry-account" label={t("admin.imageRegistry.account")}>
            <Input id="registry-account" value={account} disabled={disabled} autoComplete="off" spellCheck={false}
              placeholder={t("admin.imageRegistry.accountPlaceholder")}
              onChange={(event) => edit(() => setAccount(event.target.value), true)} />
          </Field>
          <Field id="registry-push-token" label={t("admin.imageRegistry.pushToken")} help={t("admin.imageRegistry.pushTokenHelp")}>
            <PasswordInput id="registry-push-token" value={pushToken} disabled={disabled} autoComplete="new-password" spellCheck={false}
              placeholder={settings.PushTokenSet && sameAccount ? t("admin.imageRegistry.tokenSet") : t("admin.imageRegistry.tokenPlaceholder")}
              onChange={(event) => edit(() => setPushToken(event.target.value))} />
          </Field>
          <Field id="registry-pull-token" label={t("admin.imageRegistry.pullToken")} help={t("admin.imageRegistry.pullTokenHelp")}>
            <PasswordInput id="registry-pull-token" value={pullToken} disabled={disabled || clearPull} autoComplete="new-password" spellCheck={false}
              placeholder={settings.PullTokenSet && sameAccount && !clearPull ? t("admin.imageRegistry.tokenSet") : t("admin.imageRegistry.tokenPlaceholder")}
              onChange={(event) => edit(() => setPullToken(event.target.value))} />
            {canWrite && settings.PullTokenSet && sameAccount && (
              <Checkbox label={t("admin.imageRegistry.clearPullToken")} checked={clearPull}
                onChange={(event) => edit(() => { setClearPull(event.target.checked); if (event.target.checked) setPullToken("") })} />
            )}
          </Field>
        </div>

        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label={t("admin.imageRegistry.repository")}>
            <SelectMenu
              ariaLabel={t("admin.imageRegistry.repository")}
              className="w-full"
              value={repository}
              disabled={disabled || repositories === null}
              placeholder={repositories === null ? t("admin.imageRegistry.repositoryPlaceholder") : t("admin.imageRegistry.repositoryPick")}
              options={repoOptions}
              onChange={(value) => edit(() => setRepository(value))}
            />
          </Field>
          {canWrite && (
            <Button type="button" variant="outline" busy={listBusy} disabled={!account_} onClick={() => void list()}>{t("admin.imageRegistry.listRepositories")}</Button>
          )}
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}
        {info && <Alert variant="info">{info}</Alert>}

        {canWrite && (
          <div className="flex flex-wrap items-center gap-3">
            <SaveButton dirty={dirty && canSave} busy={saveBusy} onClick={() => void save()}>{t("admin.imageRegistry.save")}</SaveButton>
            {settings.Configured && (
              <Button type="button" variant="outline" onClick={() => { setDisconnectError(""); setDisconnecting(true) }}>{t("admin.imageRegistry.disconnect")}</Button>
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={disconnecting}
        onCancel={() => setDisconnecting(false)}
        tone="danger"
        title={t("admin.imageRegistry.disconnectTitle")}
        description={t("admin.imageRegistry.disconnectBody")}
        cancelLabel={t("admin.imageRegistry.cancel")}
        confirmLabel={t("admin.imageRegistry.disconnectConfirm")}
        busy={disconnectBusy}
        error={disconnectError}
        onConfirm={() => void disconnect()}
      />
    </Card>
  )
}
