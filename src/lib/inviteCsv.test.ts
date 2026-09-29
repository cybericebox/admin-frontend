import { describe, expect, it } from "vitest"
import { csvTemplate, parseUserInviteCsv, readCsvLines, userInviteColumns } from "./inviteCsv"

describe("platform invitation CSV", () => {
  it("matches English headers in any case and order and ignores unknown columns", () => {
    const csv = "\uFEFFRole,Phone,EMAIL,first_name,Last_Name\nadmin,1,Olena@Example.test,Олена,\"Коваль, Олена\"\n,2,ivan@example.test,Іван,Мельник\n"
    expect(parseUserInviteCsv(csv, ["admin", "user"])).toEqual({ issues: [], entries: [
      { email: "olena@example.test", firstName: "Олена", lastName: "Коваль, Олена", role: "admin", row: 2 },
      { email: "ivan@example.test", firstName: "Іван", lastName: "Мельник", role: undefined, row: 3 },
    ] })
  })

  it("reports row-numbered issues and roles above the caller's rights", () => {
    const csv = "email;role\nbad;user\n;user\na@x.test;wizard\nb@x.test;super_admin\nc@x.test;USER\n"
    const result = parseUserInviteCsv(csv, ["admin", "admin_viewer", "user"])
    expect(result.issues).toEqual([
      { row: 2, code: "invalidEmail", value: "bad" },
      { row: 3, code: "missingEmail" },
      { row: 4, code: "invalidRole", value: "wizard" },
      { row: 5, code: "roleForbidden", value: "super_admin" },
    ])
    expect(result.entries.map((entry) => [entry.email, entry.role])).toEqual([["c@x.test", "user"]])
  })

  it("requires the email column and data", () => {
    expect(parseUserInviteCsv("name\nx\n", ["user"]).issues).toEqual([{ row: 1, code: "missingColumn", column: "email" }])
    expect(parseUserInviteCsv("email\n", ["user"]).issues).toEqual([{ row: 1, code: "empty" }])
  })

  it("keeps quoted delimiters and builds a template", () => {
    expect(readCsvLines('a,b\n"x, y","z ""q"""\n')[1].cells).toEqual(["x, y", 'z "q"'])
    expect(csvTemplate(["email", "role"], [["a@x.test", "user"]])).toBe("\uFEFFemail,role\r\na@x.test,user\r\n")
  })

  it("rejects the unchanged template row instead of inviting example.com", () => {
    const csv = csvTemplate(userInviteColumns, [["olena.koval@example.com", "Олена", "Коваль", "user"]]) + "real@school.test,,,\r\n"
    const result = parseUserInviteCsv(csv, ["user"])
    expect(result.issues).toEqual([{ row: 2, code: "exampleRow" }])
    expect(result.entries.map((entry) => entry.email)).toEqual(["real@school.test"])
  })
})
