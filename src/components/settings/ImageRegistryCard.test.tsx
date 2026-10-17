import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ImageRegistrySettings } from "@/api/imageRegistry/settings"

const save = vi.fn()
const clear = vi.fn()
const list = vi.fn()
vi.mock("@/api/imageRegistry/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/imageRegistry/settings")>()),
  saveImageRegistrySettings: (input: unknown) => save(input),
  clearImageRegistrySettings: () => clear(),
  listImageRegistryRepositories: (input: unknown) => list(input),
}))
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

import { ApiError } from "@/api/client"
import { ImageRegistryCard } from "./ImageRegistryCard"

const empty: ImageRegistrySettings = { Configured: false, Provider: "", Account: "", Repository: "", PushTokenSet: false, PullTokenSet: false, SecretsKeyMissing: false, UpdatedAt: null }
const saved: ImageRegistrySettings = { ...empty, Configured: true, Provider: "ghcr", Account: "icebox", Repository: "icebox/images", PushTokenSet: true, UpdatedAt: "2026-10-17T10:00:00Z" }

function renderCard(view: ImageRegistrySettings, canWrite = true, onChange = vi.fn()) {
  render(<ImageRegistryCard settings={view} canWrite={canWrite} onChange={onChange} />)
  return onChange
}

describe("ImageRegistryCard", () => {
  beforeEach(() => { save.mockReset(); clear.mockReset(); list.mockReset() })

  it("never pre-fills a token and shows the saved placeholder", () => {
    renderCard({ ...saved, PullTokenSet: true })
    const push = screen.getByLabelText("Токен для завантаження образів") as HTMLInputElement
    expect(push.value).toBe("")
    expect(push.placeholder).toBe("збережено")
    expect((screen.getByLabelText("Токен для отримання образів") as HTMLInputElement).placeholder).toBe("збережено")
  })

  it("keeps the repository dropdown disabled until the repositories are listed", async () => {
    renderCard(empty)
    fireEvent.change(screen.getByLabelText("Обліковий запис"), { target: { value: "icebox" } })
    fireEvent.change(screen.getByLabelText("Токен для завантаження образів"), { target: { value: "tok" } })
    const dropdown = screen.getByRole("button", { name: "Репозиторій" })
    expect(dropdown).toBeDisabled()
    list.mockResolvedValue(["icebox/a", "icebox/b"])
    fireEvent.click(screen.getByRole("button", { name: "Показати репозиторії" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Репозиторій" })).toBeEnabled())
    expect(list).toHaveBeenCalledWith({ Provider: "dockerhub", Account: "icebox", Token: "tok" })
  })

  it("sends empty tokens when nothing was typed", async () => {
    const onChange = renderCard({ ...saved, PullTokenSet: true })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
    fireEvent.click(screen.getByLabelText("Прибрати токен для отримання образів"))
    save.mockResolvedValue(saved)
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(save).toHaveBeenCalledWith({ Provider: "ghcr", Account: "icebox", Repository: "icebox/images", PushToken: "", PullToken: "", ClearPullToken: true }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(saved))
  })

  it("shows the translated registry failure reason inline", async () => {
    renderCard(saved)
    fireEvent.change(screen.getByLabelText("Токен для завантаження образів"), { target: { value: "bad" } })
    const body = { Status: { Code: 72802, Context: { reason: "unauthorized", token: "push" } } }
    save.mockRejectedValue(new ApiError(409, body, "x", undefined, 72802))
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect((await screen.findByRole("alert")).textContent).toContain("Сховище відхилило токен або обліковий запис")
  })

  it("requires confirmation before disconnecting", async () => {
    const onChange = renderCard(saved)
    fireEvent.click(screen.getByRole("button", { name: "Відʼєднати сховище" }))
    expect(clear).not.toHaveBeenCalled()
    clear.mockResolvedValue(empty)
    fireEvent.click(await screen.findByRole("button", { name: "Відʼєднати" }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(empty))
  })

  it("warns when the secrets key is missing", () => {
    renderCard({ ...empty, SecretsKeyMissing: true })
    expect(screen.getByText(/Ключ шифрування секретів платформи/)).toBeTruthy()
  })

  it("is read-only without the write permission", () => {
    renderCard(saved, false)
    expect(screen.getByLabelText("Обліковий запис")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Зберегти" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Відʼєднати сховище" })).toBeNull()
  })
})
