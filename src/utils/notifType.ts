// Humanise a backend notification-type key for display.
// "user.account_created" → "User Account Created": split on dots/underscores,
// drop empties, Title-Case each word. Backend keys stay the source of truth;
// this only affects how they are shown to admins.
export function formatNotifType(type: string): string {
  return type
    .split(/[._]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
