const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]]

// «5 хвилин тому» in Ukrainian, the active language of the UI.
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  const [unit, size] = UNITS.find(([, size]) => seconds >= size) ?? UNITS[UNITS.length - 1]
  return new Intl.RelativeTimeFormat("uk", { numeric: "auto" }).format(-Math.floor(seconds / size), unit)
}
