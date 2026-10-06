import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { RoleProvider, useRole } from "./useRole"
import { reportServiceAvailable, reportServiceUnavailable } from "./serviceStatus"
import { fetchMe } from "./auth"

vi.mock("./auth", () => ({ fetchMe: vi.fn() }))

function State() {
  const { isLoading, role, error, retry } = useRole()
  return <><span>{isLoading ? "loading" : error ? "failed" : role ?? "anonymous"}</span><button onClick={retry}>retry</button></>
}

afterEach(() => {
  reportServiceAvailable()
  vi.mocked(fetchMe).mockReset()
})

describe("admin session check", () => {
  it("reports a failed session check instead of staying on the loader", async () => {
    reportServiceUnavailable()
    vi.mocked(fetchMe).mockRejectedValue(new Error("API 502"))
    render(<RoleProvider><State /></RoleProvider>)
    expect(await screen.findByText("failed")).toBeInTheDocument()
  })

  it("retries the session check", async () => {
    vi.mocked(fetchMe).mockRejectedValueOnce(new Error("API 500")).mockResolvedValue(null)
    render(<RoleProvider><State /></RoleProvider>)
    await screen.findByText("failed")
    fireEvent.click(screen.getByRole("button"))
    expect(await screen.findByText("anonymous")).toBeInTheDocument()
  })

  it("treats a confirmed anonymous session as signed out", async () => {
    vi.mocked(fetchMe).mockResolvedValue(null)
    render(<RoleProvider><State /></RoleProvider>)
    expect(await screen.findByText("anonymous")).toBeInTheDocument()
  })
})
