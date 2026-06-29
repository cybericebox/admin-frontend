const STYLES: Record<string, string> = {
  done: "bg-primary/15 text-primary",
  active: "bg-primary/15 text-primary",
  published: "bg-primary/15 text-primary",
  error: "bg-destructive/15 text-destructive",
  pending: "bg-muted text-muted-foreground",
  started: "bg-secondary text-secondary-foreground",
  draft: "bg-muted text-muted-foreground",
  unpublished: "bg-muted text-muted-foreground",
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {label ?? status}
    </span>
  )
}
