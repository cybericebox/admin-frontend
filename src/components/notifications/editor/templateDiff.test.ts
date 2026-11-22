import { describe, expect, it } from "vitest"
import { emailLines, inAppLines, lineDiff } from "./templateDiff"

describe("template version diff", () => {
  it("marks removed, added and unchanged lines in reading order", () => {
    expect(lineDiff(["a", "b", "c"], ["a", "x", "c", "d"])).toEqual([
      { kind: "same", text: "a" }, { kind: "removed", text: "b" }, { kind: "added", text: "x" }, { kind: "same", text: "c" }, { kind: "added", text: "d" },
    ])
    expect(lineDiff([], ["a"])).toEqual([{ kind: "added", text: "a" }])
    expect(lineDiff(["a"], ["a"])).toEqual([{ kind: "same", text: "a" }])
  })
  it("reads an email version as its subject, preheader and the text of its blocks", () => {
    const lexical = { root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "Hello " }, { type: "text", text: "{{user_name}}" }] }, { type: "paragraph", children: [{ type: "text", text: "Welcome" }] }] } }
    const lines = emailLines({ Subject: "Hi", Preheader: "", Body: [{ type: "rich_text", content: lexical }, { type: "button", label: "Open", url: "https://x" }] as never }, { subject: "Subject", preheader: "Preheader", button: "Button", image: "Image" })
    expect(lines).toEqual(["Subject: Hi", "Hello {{user_name}}", "Welcome", "Button: Open → https://x"])
  })
  it("reads an in-app version as its title, body lines and link", () => {
    expect(inAppLines({ Title: "T", Body: "one\n\ntwo", Link: "/x" }, { title: "Title", link: "Link" })).toEqual(["Title: T", "one", "two", "Link: /x"])
  })
})
