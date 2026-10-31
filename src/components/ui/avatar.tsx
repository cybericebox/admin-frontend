import { mediaUrl } from "@/api/client"
import { initials } from "@/lib/initials"
import { cn } from "@/utils/cn"

/** A person's picture, or their initials on the brand fill when there is none. Decorative: the name is shown beside it. */
export function Avatar({ picture, firstName, lastName, email, size = "md", className }: {
  picture?: string
  firstName?: string
  lastName?: string
  email?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const box = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"
  return <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ib-brand)] font-medium text-[var(--ib-on-brand)]", box, className)}>
    {picture
      // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized images
      ? <img src={mediaUrl(picture)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      : initials(firstName, lastName, email)}
  </span>
}
