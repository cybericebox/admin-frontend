import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ImageRegistrySettings, RegistryCheck } from "@/api/imageRegistry/settings"

const save = vi.fn()
const clear = vi.fn()
const list = vi.fn()
const check = vi.fn()
vi.mock("@/api/imageRegistry/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/imageRegistry/settings")>()),
  saveImageRegistrySettings: (input: unknown) => save(input),
  clearImageRegistrySettings: () => clear(),
  listImageRegistryRepositories: (input: unknown) => list(input),
  checkImageRegistryNow: () => check(),
}))
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

import { ApiError } from "@/api/client"
import { ImageRegistryCard } from "./ImageRegistryCard"

const never: RegistryCheck = { State: "", CheckedAt: null, Reason: "", AttemptedAt: null, Failure: "" }
const empty: ImageRegistrySettings = {
  Configured: false, Provider: "", Account: "", Repository: "", PushTokenSet: false, PullTokenSet: false, SecretsKeyMissing: false, UpdatedAt: null,
  PushCheck: never, PullCheck: never,
}
const saved: ImageRegistrySettings = { ...empty, Configured: true, Provider: "ghcr", Account: "icebox", Repository: "icebox/images", PushTokenSet: true, UpdatedAt: "2026-10-17T10:00:00Z" }

function renderCard(view: ImageRegistrySettings, canWrite = true, onChange = vi.fn()) {
  render(<ImageRegistryCard settings={view} canWrite={canWrite} onChange={onChange} />)
  return onChange
}

describe("ImageRegistryCard", () => {
  beforeEach(() => { save.mockReset(); clear.mockReset(); list.mockReset(); check.mockReset() })

  it("never pre-fills a token and shows the saved placeholder", () => {
    renderCard({ ...saved, PullTokenSet: true })
    const push = screen.getByLabelText("Токен для завантаження образів") as HTMLInputElement
    expect(push.value).toBe("")
    expect(push.placeholder).toBe("збережено")
    expect((screen.getByLabelText("Токен для отримання образів") as HTMLInputElement).placeholder).toBe("збережено")
  })

  it("warns that the push token pulls when no pull token is saved", () => {
    const { unmount } = render(<ImageRegistryCard settings={saved} canWrite onChange={vi.fn()} />)
    expect(screen.getByText(/заходи отримуватимуть образи/)).toBeTruthy()
    unmount()
    render(<ImageRegistryCard settings={{ ...saved, PullTokenSet: true }} canWrite onChange={vi.fn()} />)
    expect(screen.queryByText(/заходи отримуватимуть образи/)).toBeNull()
  })

  it("keeps password managers off the account and the tokens", () => {
    renderCard(saved)
    for (const label of ["Обліковий запис", "Токен для завантаження образів", "Токен для отримання образів"]) {
      const field = screen.getByLabelText(label)
      expect(field).toHaveAttribute("autocomplete", "off")
      expect(field).toHaveAttribute("data-1p-ignore")
      expect(field).toHaveAttribute("data-lpignore", "true")
    }
  })

  it("has no show button on the write-only tokens", () => {
    renderCard(saved)
    expect(screen.queryByRole("button", { name: "Показати" })).toBeNull()
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
    expect(await screen.findByText(/Реєстр відхилив токен або обліковий запис/)).toBeTruthy()
  })

  it("requires confirmation before disconnecting", async () => {
    const onChange = renderCard(saved)
    fireEvent.click(screen.getByRole("button", { name: "Відʼєднати реєстр" }))
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
    expect(screen.queryByRole("button", { name: "Відʼєднати реєстр" })).toBeNull()
  })

  it("drops the clear-pull flag when the account changes", async () => {
    renderCard({ ...saved, PullTokenSet: true })
    fireEvent.click(screen.getByLabelText("Прибрати токен для отримання образів"))
    fireEvent.change(screen.getByLabelText("Обліковий запис"), { target: { value: "other" } })
    expect(screen.getByLabelText("Токен для отримання образів")).toBeEnabled()
    fireEvent.change(screen.getByLabelText("Токен для завантаження образів"), { target: { value: "tok" } })
    list.mockResolvedValue(["other/a"])
    fireEvent.click(screen.getByRole("button", { name: "Показати репозиторії" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Репозиторій" })).toBeEnabled())
    fireEvent.keyDown(screen.getByRole("button", { name: "Репозиторій" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "other/a" }))
    save.mockResolvedValue(saved)
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ ClearPullToken: false })))
  })

  it("saves with a typed push token when the same account has none stored", async () => {
    renderCard({ ...saved, PushTokenSet: false })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Токен для завантаження образів"), { target: { value: "tok" } })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled()
  })

  it("ignores a repository list that arrives after the account changed", async () => {
    renderCard(empty)
    fireEvent.change(screen.getByLabelText("Обліковий запис"), { target: { value: "first" } })
    let resolve!: (v: string[]) => void
    list.mockReturnValue(new Promise<string[]>((r) => { resolve = r }))
    fireEvent.click(screen.getByRole("button", { name: "Показати репозиторії" }))
    fireEvent.change(screen.getByLabelText("Обліковий запис"), { target: { value: "second" } })
    resolve(["first/a"])
    await waitFor(() => expect(screen.getByRole("button", { name: "Показати репозиторії" })).toBeEnabled())
    expect(screen.getByRole("button", { name: "Репозиторій" })).toBeDisabled()
  })

  it("shows an empty repository list as information, not an error", async () => {
    renderCard(empty)
    fireEvent.change(screen.getByLabelText("Обліковий запис"), { target: { value: "icebox" } })
    list.mockResolvedValue([])
    fireEvent.click(screen.getByRole("button", { name: "Показати репозиторії" }))
    const note = await screen.findByText("Токен не бачить жодного репозиторію.")
    expect(note.closest("[role=alert]")?.className ?? "").not.toMatch(/destructive/)
    expect(note.closest("[role=alert]")).not.toBeNull()
  })

  it("disables Save while the secrets key is missing", () => {
    renderCard({ ...saved, SecretsKeyMissing: true })
    fireEvent.change(screen.getByLabelText("Токен для завантаження образів"), { target: { value: "tok" } })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
  })

  describe("credential check", () => {
    const ok: RegistryCheck = { State: "ok", CheckedAt: "2026-10-18T09:00:00Z", Reason: "", AttemptedAt: "2026-10-18T09:00:00Z", Failure: "" }
    const broken: RegistryCheck = { State: "broken", CheckedAt: "2026-10-18T09:00:00Z", Reason: "unauthorized", AttemptedAt: "2026-10-18T09:00:00Z", Failure: "" }

    it("shows nothing before the registry is configured", () => {
      renderCard(empty)
      expect(screen.queryByRole("button", { name: "Перевірити зараз" })).toBeNull()
    })

    it("reads works / does not work with the reason, per token", () => {
      renderCard({ ...saved, PullTokenSet: true, PushCheck: ok, PullCheck: broken })
      expect(screen.getByText(/Перевірено: .+ — працює/)).toBeTruthy()
      expect(screen.getByText(/Перевірено: .+ — не працює: реєстр відхилив токен/)).toBeTruthy()
      expect(screen.getByText("Токен для завантаження").closest("[data-state]")?.getAttribute("data-state")).toBe("ok")
      expect(screen.getByText("Токен для отримання").closest("[data-state]")?.getAttribute("data-state")).toBe("broken")
    })

    it("names a missing repository as the reason", () => {
      renderCard({ ...saved, PushCheck: { ...broken, Reason: "not_found" } })
      expect(screen.getByText(/не працює: репозиторій не знайдено/)).toBeTruthy()
    })

    it("says so when never checked and hides the pull line without a pull token", () => {
      renderCard(saved)
      expect(screen.getByText(/ще не перевірено/)).toBeTruthy()
      expect(screen.queryByText("Токен для отримання")).toBeNull()
    })

    it("tells a failed attempt will be retried while keeping the previous state", () => {
      renderCard({ ...saved, PushCheck: { ...ok, AttemptedAt: "2026-10-18T15:00:00Z", Failure: "unreachable" } })
      expect(screen.getByText(/працює/)).toBeTruthy()
      expect(screen.getByText(/Остання спроба .+ не вдалася \(реєстр не відповідає\), її буде повторено/)).toBeTruthy()
    })

    it("checks now, busies only its own button and hands the result up", async () => {
      const onChange = renderCard({ ...saved, PushCheck: ok })
      fireEvent.change(screen.getByLabelText("Обліковий запис"), { target: { value: "typed" } })
      let resolve!: (v: ImageRegistrySettings) => void
      check.mockReturnValue(new Promise<ImageRegistrySettings>((r) => { resolve = r }))
      fireEvent.click(screen.getByRole("button", { name: "Перевірити зараз" }))
      // the busy button also carries the crest loader's label
      expect(screen.getByRole("button", { name: /Перевірити зараз/ })).toBeDisabled()
      expect(screen.getByLabelText("Обліковий запис")).toBeEnabled()
      expect(screen.getByLabelText("Токен для завантаження образів")).toBeEnabled()
      const next = { ...saved, PushCheck: broken }
      resolve(next)
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(next))
      await waitFor(() => expect(screen.getByRole("button", { name: "Перевірити зараз" })).toBeEnabled())
      expect((screen.getByLabelText("Обліковий запис") as HTMLInputElement).value).toBe("typed")
    })

    it("shows a failed check call inline", async () => {
      renderCard(saved)
      const body = { Status: { Code: 72801, Context: { reason: "unreachable", token: "" } } }
      check.mockRejectedValue(new ApiError(409, body, "x", undefined, 72801))
      fireEvent.click(screen.getByRole("button", { name: "Перевірити зараз" }))
      expect(await screen.findByText("Реєстр образів не відповідає.")).toBeTruthy()
    })

    it("is not offered without the write permission, but the result is shown", () => {
      renderCard({ ...saved, PushCheck: ok }, false)
      expect(screen.queryByRole("button", { name: "Перевірити зараз" })).toBeNull()
      expect(screen.getByText(/працює/)).toBeTruthy()
    })
  })
})
