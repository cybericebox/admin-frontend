/* Types for IB.ChartTheme (chart-theme.js). Copy both files into an app; import this helper instead of per-file hex colours. */
export interface ChartTokens {
  font: string; fsAxis: number; fsLegend: number; lineWidth: number
  axis: string; legend: string; grid: string; line: string; ink: string; surface: string; raised: string; tipLine: string
  own: string; other: string; series: string[]; reducedMotion: boolean
}
export interface EchartsOptions { legend?: boolean; timeAxis?: boolean; zoom?: boolean; minInterval?: number }
export interface LineExtra { own?: boolean; index?: number; color?: string; symbols?: boolean; endLabel?: boolean; series?: Record<string, unknown> }
export interface ChartTheme {
  tokens(el?: Element): ChartTokens
  echarts(el: Element, opts?: EchartsOptions): Record<string, any>
  lineSeries(el: Element, name: string, data: unknown[], extra?: LineExtra): Record<string, any>
  describe(host: Element, label: string, tableId?: string): void
  watch(el: Element, cb: () => void): () => void
}
declare global { interface Window { IB: { ChartTheme: ChartTheme } & Record<string, any> } }
