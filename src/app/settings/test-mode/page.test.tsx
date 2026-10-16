import {beforeEach, expect, it, vi} from "vitest"
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react"
import {PreviewDefaultsEditor} from "./page"

const api = vi.hoisted(() => ({get: vi.fn(), catalog: vi.fn(), save: vi.fn(), write: true}))
vi.mock("@/api/participantPreviewSettings", async original => ({...await original<typeof import("@/api/participantPreviewSettings")>(), getPreviewSettings: api.get, getPreviewCatalog: api.catalog, savePreviewSettings: api.save}))
vi.mock("@/lib/useRole", () => ({useRole: () => ({can: () => api.write})}))
vi.mock("@/components/ui/toast", () => ({toast: {success: vi.fn()}}))
const selected = {ExerciseVersionID: "v1", VariantID: "a", Name: "Файл"}
const catalog = [
  {ID: "e1", ExerciseVersionID: "v1", Name: "Файл", Infrastructure: false, Variants: [{ID: "a", Index: 0}]},
  {ID: "e2", ExerciseVersionID: "v2", Name: "Сервіс", Infrastructure: true, Variants: [{ID: "b", Index: 0}]},
]
beforeEach(() => {
  vi.clearAllMocks(); api.write = true
  api.get.mockResolvedValue({Inherit: false, GroupName: "Тестові завдання", GroupNameOverride: null, Selections: [selected], EffectiveSelections: [selected]})
  api.catalog.mockResolvedValue(catalog)
  api.save.mockImplementation(async ({GroupName, Selections}) => ({Inherit: false, GroupName, GroupNameOverride: null, Selections, EffectiveSelections: Selections}))
})

it("loads platform defaults and saves an explicit empty selection", async () => {
  render(<PreviewDefaultsEditor />)
  fireEvent.click(await screen.findByRole("button", {name: "Прибрати «Файл»"}))
  fireEvent.click(screen.getByRole("button", {name: "Зберегти"}))
  await waitFor(() => expect(api.save).toHaveBeenCalledWith({GroupName: "Тестові завдання", Selections: []}))
})

it("keeps controls enabled and newer edits when a save completes", async () => {
  let finish!: (value: unknown) => void
  api.save.mockReturnValue(new Promise(resolve => {finish = resolve}))
  render(<PreviewDefaultsEditor />)
  const service = await screen.findByRole("checkbox", {name: "Сервіс"})
  fireEvent.click(service)
  fireEvent.click(screen.getByRole("button", {name: "Зберегти"}))
  expect(service).not.toBeDisabled()
  fireEvent.click(service)
  await act(async () => finish({Inherit: false, GroupName: "Тестові завдання", GroupNameOverride: null, Selections: [selected, {ExerciseVersionID: "v2", VariantID: "b", Name: "Сервіс"}], EffectiveSelections: []}))
  expect(service).not.toBeChecked()
  expect(screen.getByRole("button", {name: "Зберегти"})).not.toBeDisabled()
})

it("keeps edits after a save failure", async () => {
  api.save.mockRejectedValue(new Error("failed"))
  render(<PreviewDefaultsEditor />)
  fireEvent.click(await screen.findByRole("checkbox", {name: "Сервіс"}))
  fireEvent.click(screen.getByRole("button", {name: "Зберегти"}))
  expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося зберегти")
  expect(screen.getByRole("checkbox", {name: "Сервіс"})).toBeChecked()
})

it("shows the set without editing or catalog requests for a read-only viewer", async () => {
  api.write = false
  render(<PreviewDefaultsEditor />)
  expect(await screen.findByText("Файл")).toBeTruthy()
  expect(screen.queryByRole("button", {name: "Зберегти"})).toBeNull()
  expect(api.catalog).not.toHaveBeenCalled()
})


it("saves the single group name with the selected exercises", async () => {
  render(<PreviewDefaultsEditor />)
  fireEvent.change(await screen.findByRole("textbox", {name: "Назва групи"}), {target: {value: "Підготовка"}})
  fireEvent.click(screen.getByRole("button", {name: "Зберегти"}))
  await waitFor(() => expect(api.save).toHaveBeenCalledWith({GroupName: "Підготовка", Selections: [selected]}))
})
