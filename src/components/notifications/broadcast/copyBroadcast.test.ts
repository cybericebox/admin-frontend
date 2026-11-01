import { describe, expect, it } from "vitest"
import type { Broadcast } from "@/api/notifications/broadcasts"
import { audienceFromBroadcast } from "./AudiencePicker"
import { messageFromBroadcast } from "./broadcastMessage"

const source = { Channels: ["in_app"], Subject: "S", Preheader: "P", EmailBody: [], InAppTitle: "T", InAppBody: "B", InAppLink: "/x", Audience: { Kind: "roles", Roles: ["admin"] } } as unknown as Broadcast

describe("copying a broadcast", () => {
  it("turns a sent broadcast back into an editable message with its channels", () => {
    expect(messageFromBroadcast(source)).toMatchObject({ email: false, inApp: true, subject: "S", title: "T", inAppBody: "B", link: "/x" })
  })
  it("restores roles and users audiences", () => {
    expect(audienceFromBroadcast(source)).toEqual({ kind: "roles", roles: ["admin"], users: [] })
    expect(audienceFromBroadcast({ ...source, Audience: { Kind: "users", UserIDs: ["11111111-aaaa"] } } as Broadcast).users).toEqual([{ id: "11111111-aaaa", name: "11111111", email: "" }])
    expect(audienceFromBroadcast({ ...source, Audience: { Kind: "all" } } as Broadcast).kind).toBe("all")
  })
})
