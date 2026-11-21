import { registerLocale } from "echarts"
import * as uk from "echarts/i18n/langUK-obj.js"
import { CHART_LOCALE } from "./chartLocaleName"

// ECharts' own Ukrainian locale: month and weekday names on time axes read as the Ukrainian abbreviation of October, not "Oct".
const locale = (uk as { default?: unknown }).default ?? uk
registerLocale(CHART_LOCALE, locale as Parameters<typeof registerLocale>[1])
