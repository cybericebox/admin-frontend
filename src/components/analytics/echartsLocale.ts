import { registerLocale } from "echarts"
import * as uk from "echarts/i18n/langUK-obj.js"
import { CHART_LOCALE } from "./chartLocaleName"

// ECharts' own Ukrainian locale: month and weekday names on time axes read «Жов», not «Oct».
const locale = (uk as { default?: unknown }).default ?? uk
registerLocale(CHART_LOCALE, locale as Parameters<typeof registerLocale>[1])
