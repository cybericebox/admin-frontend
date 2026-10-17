import { isOverloadError } from "@/api/retry"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { toast } from "./toast"

/** The localized API error; an overload error also offers «Спробувати ще раз» when `retry` is given. */
export function toastApiError(err: unknown, retry?: () => void) {
  toast.error(localizedError(err), retry && isOverloadError(err) ? { action: { label: t("error.overloaded.retry"), onClick: retry } } : undefined)
}
