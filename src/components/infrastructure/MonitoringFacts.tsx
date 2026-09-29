"use client"

import { EmptyState } from "@/components/ui/empty-state"
import { formatBytes, formatCpu, monitoringUpdateDetails } from "@/lib/infrastructureMonitoring"
import { t } from "@/i18n/t"

function phaseLabel(phase: string): string {
  switch (phase.toLowerCase()) {
    case "ready": return t("admin.labs.phase.ready")
    case "running": return t("admin.labs.phase.running")
    case "pending": return t("admin.labs.phase.pending")
    case "creating": return t("admin.labs.phase.creating")
    case "failed": return t("admin.labs.phase.failed")
    case "suspended": return t("admin.labs.phase.suspended")
    case "stopped": return t("admin.labs.phase.stopped")
    default: return t("admin.labs.unknownState")
  }
}

function resourceKindLabel(kind: string): string {
  switch (kind.toLowerCase()) {
    case "lab": return t("admin.labs.kind.lab")
    case "group": case "labgroup": case "lab_group": return t("admin.labs.kind.group")
    case "client": case "labgroupclient": return t("admin.labs.kind.client")
    case "policy": case "labgroupaccesspolicy": case "access_policy": return t("admin.labs.kind.policy")
    default: return t("admin.labs.kind.resource")
  }
}

export function MonitoringFacts({ payload }: { payload: unknown }) {
  const details = monitoringUpdateDetails(payload)
  if (Object.values(details).every((items) => items.length === 0)) return <EmptyState message={t("admin.labs.facts.empty")} compact className="mt-2 min-w-72" />
  const section = "space-y-1 border-t border-border py-2 first:border-t-0 first:pt-0"
  return <div className="mt-2 min-w-72 text-xs text-foreground">
    {details.groups.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.groups")}</h4>{details.groups.map((group, index) => <p key={index}>{group.name || t("admin.labs.facts.unnamed")}{group.phase && ` · ${phaseLabel(group.phase)}`}{group.vpnRegistered !== null && t(group.vpnRegistered ? "admin.labs.facts.vpnConnected" : "admin.labs.facts.vpnDisconnected")}</p>)}</section>}
    {details.labs.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.labs")}</h4>{details.labs.map((lab, index) => <div key={index} className="space-y-1"><p className="font-medium">{lab.name || t("admin.labs.facts.unnamed")}{lab.phase && <span className="font-normal text-muted-foreground"> · {phaseLabel(lab.phase)}</span>}</p>{lab.devices.map((device, deviceIndex) => <div key={deviceIndex} className="flex flex-wrap gap-x-3 pl-3"><span>{device.name || t("admin.labs.facts.unnamed")}</span><span className="tabular-nums">{t("admin.labs.facts.cpu", { value: formatCpu(device.cpu) })}</span><span>{t("admin.labs.facts.memory", { value: formatBytes(device.memory) })}</span>{device.restarts !== null && <span>{t("admin.labs.facts.restarts", { count: device.restarts })}</span>}</div>)}</div>)}</section>}
    {details.clients.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.clients")}</h4>{details.clients.map((client, index) => <div key={index} className="flex flex-wrap gap-x-3"><span className="font-medium">{client.name || t("admin.labs.facts.unnamed")}</span>{client.ip && <span>{client.ip}</span>}{client.received !== null && <span>{t("admin.labs.facts.received", { value: formatBytes(client.received) })}</span>}{client.sent !== null && <span>{t("admin.labs.facts.sent", { value: formatBytes(client.sent) })}</span>}</div>)}</section>}
    {details.rules.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.rules")}</h4>{details.rules.map((rule, index) => <div key={index} className="flex flex-wrap gap-x-3"><span>{t("admin.labs.facts.rule", { client: rule.client || t("admin.labs.facts.client"), lab: rule.lab || t("admin.labs.facts.lab") })}</span><span>{rule.action === "LAB_GROUP_ACCESS_ACTION_DENY" ? t("admin.labs.facts.denied") : rule.action === "LAB_GROUP_ACCESS_ACTION_ALLOW" ? t("admin.labs.facts.allowed") : t("admin.labs.facts.unknownState")}</span>{rule.packets !== null && rule.bytes !== null && <span>{t("admin.labs.facts.traffic", { packets: rule.packets, bytes: formatBytes(rule.bytes) })}</span>}</div>)}</section>}
    {details.deleted.length > 0 && <section className={section}><h4 className="font-semibold">{t("admin.labs.facts.deleted")}</h4>{details.deleted.map((item, index) => <p key={index}><span>{t("admin.labs.facts.deletedItem", { name: item.name || t("admin.labs.facts.unnamedLower") })}</span>{item.kind && <span className="text-muted-foreground"> ({resourceKindLabel(item.kind)})</span>}</p>)}</section>}
  </div>
}
