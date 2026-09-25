"use client"

import { Controller, useFormContext, useWatch } from "react-hook-form"
import { t } from "@/i18n/t"
import { Switch } from "@/components/ui/switch"
import { FieldHelp } from "@/components/ui/field-help"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

/** NetworkToggles — VPN/Internet: Enabled + DHCP per variant. */
export function NetworkToggles({
  variantIndex,
  disabled,
  network,
  showEnabled = true,
}: {
  variantIndex: number
  disabled: boolean
  network?: "VPN" | "Internet"
  showEnabled?: boolean
}) {
  const nets = [
    { key: "VPN", label: t("admin.exTopo.vpn") },
    { key: "Internet", label: t("admin.exTopo.internet") },
  ] as const

  return (
    <div className="divide-y divide-border">
      {nets.filter((net) => !network || net.key === network).map((net) => (
        <NetworkToggle key={net.key} variantIndex={variantIndex} disabled={disabled} network={net.key} label={net.label} showEnabled={showEnabled} />
      ))}
    </div>
  )
}

function NetworkToggle({ variantIndex, disabled, network, label, showEnabled }: {
  variantIndex: number
  disabled: boolean
  network: "VPN" | "Internet"
  label: string
  showEnabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const enabled = useWatch({ control, name: `Variants.${variantIndex}.Topology.${network}.Enabled` })
  const help = network === "VPN" ? "admin.exTopo.vpnHelp" : "admin.exTopo.internetHelp"
  const dhcpLabel = network === "VPN" ? "admin.exTopo.vpnDhcp" : "admin.exTopo.internetDhcp"
  return <div className="min-w-0 space-y-2 py-3 first:pt-0 last:pb-0">
    {showEnabled && <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5"><span className="text-sm font-medium">{label}</span><FieldHelp text={t(help)} /></div>
      <Controller control={control} name={`Variants.${variantIndex}.Topology.${network}.Enabled`}
        render={({ field }) => <Switch aria-label={label} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />} />
    </div>}
    {enabled && <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
      <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground">DHCP</span><FieldHelp text={t("admin.exTopo.dhcpHelp")} /></div>
      <Controller control={control} name={`Variants.${variantIndex}.Topology.${network}.DHCP`}
        render={({ field }) => <Switch aria-label={t(dhcpLabel)} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />} />
    </div>}
  </div>
}
