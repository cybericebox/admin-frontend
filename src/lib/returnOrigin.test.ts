import { describe, expect, it } from "vitest"
import { readEventReturn, validEventReturn, withAdminOrigin } from "./returnOrigin"

const DOMAIN = "example.org"
const HOSTS = ["example.org", "api.example.org", "id.example.org", "admin.example.org", "exercises.example.org"]
const store = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } }

describe("event return origin", () => {
  it("accepts only an event host's /manage over https", () => {
    expect(validEventReturn("https://ctf.example.org/manage/labs?a=1#x", DOMAIN)).toBe("https://ctf.example.org/manage/labs?a=1")
    expect(validEventReturn("https://ctf.example.org/manage", DOMAIN)).toBe("https://ctf.example.org/manage")
    for (const bad of ["https://evil.com/manage", "https://ctf.example.org.evil.com/manage", "http://ctf.example.org/manage", "https://ctf.example.org/managed", "https://ctf.example.org/", "https://a.b.example.org/manage", "https://admin.example.org/manage", "https://id.example.org/manage", "https://u:p@ctf.example.org/manage", "https://ctf.example.org:8443/manage", "javascript:alert(1)", "", null])
      expect(validEventReturn(bad, DOMAIN, HOSTS), String(bad)).toBeNull()
    expect(validEventReturn("https://ctf.example.org/manage", "")).toBeNull()
  })

  it("remembers the origin with the event name for the session", () => {
    const storage = store()
    const search = `?from=${encodeURIComponent("https://ctf.example.org/manage")}&from_name=${encodeURIComponent("CTF 2027")}`
    expect(readEventReturn(search, storage, DOMAIN, HOSTS)).toEqual({ url: "https://ctf.example.org/manage", name: "CTF 2027" })
    expect(readEventReturn("", storage, DOMAIN, HOSTS)).toEqual({ url: "https://ctf.example.org/manage", name: "CTF 2027" })
    expect(readEventReturn("?from=https%3A%2F%2Fevil.com%2Fmanage", store(), DOMAIN, HOSTS)).toBeNull()
  })

  it("adds this admin page to a link", () => {
    expect(withAdminOrigin("https://ctf.example.org/manage/labs", "https://admin.example.org/labs")).toBe("https://ctf.example.org/manage/labs?from=https%3A%2F%2Fadmin.example.org%2Flabs")
    expect(withAdminOrigin("https://ctf.example.org/manage", "")).toBe("https://ctf.example.org/manage")
  })
})
