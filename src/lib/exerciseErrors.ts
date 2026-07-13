/**
 * exerciseErrors.ts — словарь FullCode → i18n-ключ для доменных ошибок
 * exercise (objectCode 9) и media (objectCode 10).
 *
 * FullCode = informCode*10000 + objectCode*100 + detailCode
 * (inform: 2=InvalidData, 3=NotFound, 4=Exists, 7=Conflict).
 * Источник: AP Backend internal/model/exercise/errors.go, internal/model/media/errors.go.
 * Неизвестный код → generic + Status.Message бэка. 401/403 сюда не попадают
 * (их перехватывает client.ts / RBAC-гейты).
 */
import { ApiError } from "@/api/client"
import { t } from "@/i18n/t"

export const ERR_EXERCISE_EXISTS = 40903
export const ERR_EXERCISE_MODIFIED = 70904
export const ERR_NO_DRAFT = 70905
export const ERR_DRAFT_ALREADY_EXISTS = 70906

const CODE_TO_KEY: Record<number, string> = {
  // exercise: not found / exists / conflicts
  30901: "admin.ex.err.notFound",
  30902: "admin.ex.err.versionNotFound",
  40903: "admin.ex.err.exists",
  70904: "admin.ex.err.modified",
  70905: "admin.ex.err.noDraft",
  70906: "admin.ex.err.draftExists",
  70907: "admin.ex.err.secretsNotConfigured",
  // exercise: identity validation
  20908: "admin.ex.err.nameInvalid",
  20909: "admin.ex.err.descriptionTooLong",
  20910: "admin.ex.err.tagsInvalid",
  // exercise: structural validation
  20911: "admin.ex.err.noVariants",
  20912: "admin.ex.err.taskCountMismatch",
  20913: "admin.ex.err.taskNameInvalid",
  20914: "admin.ex.err.difficultyInvalid",
  20915: "admin.ex.err.flagInvalid",
  20916: "admin.ex.err.deviceNameInvalid",
  20917: "admin.ex.err.deviceTypeInvalid",
  20918: "admin.ex.err.interfaceInvalid",
  20919: "admin.ex.err.connectionEndpointsInvalid",
  20927: "admin.ex.err.externalInvalid",
  20928: "admin.ex.err.connectionArity",
  // exercise: publish-time graph validation
  20920: "admin.ex.err.endpointUnresolved",
  20921: "admin.ex.err.portInUse",
  20924: "admin.ex.err.flagDeviceUnresolved",
  20929: "admin.ex.err.vpnDisabled",
  20930: "admin.ex.err.internetDisabled",
  20931: "admin.ex.err.vpnGatewayInUse",
  20932: "admin.ex.err.internetGatewayInUse",
  20933: "admin.ex.err.deviceNameDuplicate",
  // exercise: placeholders
  20925: "admin.ex.err.placeholderInvalid",
  20926: "admin.ex.err.placeholderNode",
  // media (вложения)
  31001: "admin.ex.err.fileNotFound",
  21002: "admin.ex.err.fileTooLarge",
  71003: "admin.ex.err.storageNotConfigured",
}

type EnvelopeBody = { Status?: { Code?: number; Message?: string } }

/** FullCode из тела ошибки или null (не ApiError / нет envelope). */
export function exerciseErrorCode(e: unknown): number | null {
  if (!(e instanceof ApiError)) return null
  const body = e.body as EnvelopeBody | null | undefined
  const code = body?.Status?.Code
  return typeof code === "number" ? code : null
}

/** Человекочитаемое (украинское) сообщение для любой ошибки API exercises. */
export function exerciseErrorMessage(e: unknown): string {
  const code = exerciseErrorCode(e)
  if (code !== null) {
    const key = CODE_TO_KEY[code]
    if (key) return t(key)
    const message = ((e as ApiError).body as EnvelopeBody | null | undefined)?.Status?.Message
    if (message) return `${t("admin.ex.err.generic")}: ${message}`
  }
  return t("admin.ex.err.generic")
}
