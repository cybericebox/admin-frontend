"use client"
import { t } from "@/i18n/t"
import { PLATFORM_ROLES, roleLabel } from "@/lib/roles"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectMenu } from "@/components/ui/select-menu"
import type { BroadcastAudience } from "@/api/notifications/broadcasts"
import { UserPicker, type PickedUser } from "./UserPicker"

export type AudienceState = { kind: "all" | "roles" | "users"; roles: string[]; users: PickedUser[] }

export const EMPTY_AUDIENCE: AudienceState = { kind: "all", roles: [], users: [] }

export function audienceToApi(state: AudienceState): BroadcastAudience {
  if (state.kind === "roles") return { Kind: "roles", Roles: state.roles }
  if (state.kind === "users") return { Kind: "users", UserIDs: state.users.map((user) => user.id) }
  return { Kind: "all" }
}

// A roles/users audience with nothing chosen is incomplete: no count is requested for it.
export function audienceComplete(state: AudienceState): boolean {
  if (state.kind === "roles") return state.roles.length > 0
  if (state.kind === "users") return state.users.length > 0
  return true
}

/** Human label of a stored audience (history list and details). */
export function audienceLabel(audience: BroadcastAudience): string {
  if (audience.Kind === "roles") return `${t("admin.notif.broadcast.audience.roles")}: ${(audience.Roles ?? []).map(roleLabel).join(", ")}`
  if (audience.Kind === "users") return `${t("admin.notif.broadcast.audience.users")}: ${(audience.UserIDs ?? []).length}`
  if (audience.Kind === "all") return t("admin.notif.broadcast.audience.all")
  const key = `admin.notif.broadcast.audience.${audience.Kind}`
  const label = t(key)
  return label === key ? audience.Kind : label
}

export function AudiencePicker({ value, onChange }: { value: AudienceState; onChange: (next: AudienceState) => void }) {
  return (
    <div className="space-y-3">
      <SelectMenu
        value={value.kind}
        onChange={(kind) => onChange({ ...value, kind: kind as AudienceState["kind"] })}
        ariaLabel={t("admin.notif.broadcast.audience.title")}
        options={[
          { value: "all", label: t("admin.notif.broadcast.audience.all") },
          { value: "roles", label: t("admin.notif.broadcast.audience.roles") },
          { value: "users", label: t("admin.notif.broadcast.audience.users") },
        ]}
        className="w-full sm:w-72"
      />
      {value.kind === "roles" && (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PLATFORM_ROLES.map((role) => (
            <Checkbox key={role} checked={value.roles.includes(role)} label={roleLabel(role)}
              onChange={() => onChange({ ...value, roles: value.roles.includes(role) ? value.roles.filter((item) => item !== role) : [...value.roles, role] })} />
          ))}
        </div>
      )}
      {value.kind === "users" && <UserPicker value={value.users} onChange={(users) => onChange({ ...value, users })} />}
    </div>
  )
}
