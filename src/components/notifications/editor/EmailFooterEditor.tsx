"use client"

import { useState } from "react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { SelectMenu } from "@/components/ui/select-menu"
import { FieldHelp } from "@/components/ui/field-help"
import { BlockEditor } from "./BlockEditor"
import type { BlockPreset } from "@/api/notifications/emailTemplates"
import type { EmailBodyBlock } from "./emailBlocks"
import type { VariableDef } from "./variableUtils"

type Props = {
  presetId: string
  presets: BlockPreset[]
  variables: VariableDef[]
  readOnly: boolean
  onSelect: (id: string) => void
  onCreate: (name: string, blocks: EmailBodyBlock[]) => Promise<void>
}

export function EmailFooterEditor({ presetId, presets, variables, readOnly, onSelect, onCreate }: Props) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [blocks, setBlocks] = useState<EmailBodyBlock[]>([])
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || blocks.length === 0) return
    setSaving(true)
    try {
      await onCreate(name.trim(), blocks)
      toast.success("Нижній блок створено.")
      setCreating(false)
      setName("")
      setBlocks([])
    } catch {
      toast.error(t("admin.notif.tpl.saveError"))
    } finally {
      setSaving(false)
    }
  }

  return <section className="rounded-lg border border-border bg-card p-4">
    <div className="mb-3 flex items-center gap-1.5">
      <h2 className="text-sm font-semibold text-foreground">{t("admin.notif.editor.footer")}</h2>
      <FieldHelp text={t("admin.notif.editor.footerHelp")} />
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px] flex-1">
        <SelectMenu value={presetId} onChange={onSelect} ariaLabel={t("admin.notif.editor.footerSelect")}
          options={[{ value: "", label: t("admin.notif.editor.footerNone") }, ...presets.map((preset) => ({ value: preset.ID, label: preset.Name }))]}
          className="w-full" disabled={readOnly} />
      </div>
      {!readOnly && <Button type="button" variant="outline" onClick={() => setCreating((v) => !v)}>{t("admin.notif.editor.footerCreate")}</Button>}
    </div>
    {creating && !readOnly && <div className="mt-4 space-y-3 border-t border-border pt-4">
      <label className="block text-xs font-medium text-foreground">{t("admin.notif.editor.footerName")}
        <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <BlockEditor value={blocks} onChange={setBlocks} variables={variables} presets={[]} onSavePreset={async () => {}} showPresetSave={false} />
      <div className="flex gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving || !name.trim() || blocks.length === 0}>{t("admin.notif.editor.footerSave")}</Button>
        <Button type="button" variant="outline" onClick={() => setCreating(false)}>{t("admin.notif.editor.cancel")}</Button>
      </div>
    </div>}
  </section>
}
