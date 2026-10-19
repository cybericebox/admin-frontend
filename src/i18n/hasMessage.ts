import en from "../../messages/en.json"
import uk from "../../messages/uk.json"

/** Whether the catalog has a message for `key` (for labels of values the server may extend, like error kinds). */
export function hasMessage(key: string): boolean {
  return key in (uk as Record<string, string>) || key in (en as Record<string, string>)
}
