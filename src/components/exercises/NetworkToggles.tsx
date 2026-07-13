"use client"

import { Controller, useFormContext } from "react-hook-form"
import { t } from "@/i18n/t"
import { Switch } from "@/components/ui/switch"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

/** NetworkToggles — VPN/Internet: Enabled + DHCP per variant. */
export function NetworkToggles({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const nets = [
    { key: "VPN", label: t("admin.exTopo.vpn") },
    { key: "Internet", label: t("admin.exTopo.internet") },
  ] as const

  return (
    <div className="flex flex-wrap gap-4">
      {nets.map((net) => (
        <div key={net.key} className="flex items-center gap-4 rounded-md border border-border px-3 py-2">
          <span className="text-sm font-medium">{net.label}</span>
          <Controller
            control={control}
            name={`Variants.${variantIndex}.Topology.${net.key}.Enabled`}
            render={({ field }) => (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                {t("admin.exTopo.enabled")}
              </label>
            )}
          />
          <Controller
            control={control}
            name={`Variants.${variantIndex}.Topology.${net.key}.DHCP`}
            render={({ field }) => (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                DHCP
              </label>
            )}
          />
        </div>
      ))}
    </div>
  )
}
