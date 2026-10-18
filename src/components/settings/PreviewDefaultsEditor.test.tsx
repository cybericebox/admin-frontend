import {beforeEach, expect, it, vi} from "vitest"
import {act, fireEvent, render, screen, waitFor, within} from "@testing-library/react"
import {PreviewDefaultsEditor} from "./PreviewDefaultsEditor"

const api = vi.hoisted(() => ({get: vi.fn(), catalog: vi.fn(), save: vi.fn(), write: true}))
vi.mock("@/api/participantPreviewSettings", async original => ({...await original<typeof import("@/api/participantPreviewSettings")>(), getPreviewSettings: api.get, getPreviewCatalog: api.catalog, savePreviewSettings: api.save}))
vi.mock("@/lib/useRole", () => ({useRole: () => ({can: () => api.write})}))
vi.mock("@/components/ui/toast", () => ({toast: {success: vi.fn()}}))
const selected = {ExerciseVersionID: "v1", VariantID: "a", Name: "Файл"}
const catalog = [
  {ID: "e1", ExerciseVersionID: "v1", Name: "Файл", Infrastructure: false, Variants: [{ID: "a", Index: 0}]},
  {ID: "e2", ExerciseVersionID: "v2", Name: "Сервіс", Infrastructure: true, Variants: [{ID: "b", Index: 0}]},
]
async function openList() {
  const box = await screen.findByRole("combobox")
  fireEvent.focus(box)
  await screen.findByRole("listbox")
  return box
}
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
  await openList()
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
  await openList()
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

it("lists tasks that cannot be chosen muted with a reason, after the choosable ones, inside the dropdown", async () => {
  api.catalog.mockResolvedValue([
    {ID: "e3", ExerciseVersionID: "v3", Name: "Чернетка", Infrastructure: false, Eligible: false, Reason: "not_published", Variants: []},
    ...catalog,
  ])
  render(<PreviewDefaultsEditor />)
  await openList()
  const list = screen.getByRole("listbox")
  expect(await within(list).findByText("Не опубліковано")).toBeInTheDocument()
  expect(within(list).queryByRole("checkbox", {name: "Чернетка"})).toBeNull()
  const names = within(list).getAllByRole("option").map(item => item.textContent ?? "")
  expect(names.findIndex(text => text.includes("Сервіс"))).toBeLessThan(names.findIndex(text => text.includes("Чернетка")))
})

it("shows no permanent catalog list and opens the dropdown on input", async () => {
  render(<PreviewDefaultsEditor />)
  const box = await screen.findByRole("combobox")
  expect(screen.queryByRole("listbox")).toBeNull()
  expect(api.catalog).not.toHaveBeenCalled()
  fireEvent.change(box, {target: {value: "Серв"}})
  expect(await screen.findByRole("listbox")).toBeInTheDocument()
  await waitFor(() => expect(api.catalog).toHaveBeenCalledWith("Серв"))
  expect(await screen.findByRole("checkbox", {name: "Сервіс"})).toBeInTheDocument()
})

it("toggling in the dropdown adds and removes a row below, and x unchecks it", async () => {
  render(<PreviewDefaultsEditor />)
  await openList()
  fireEvent.click(await screen.findByRole("checkbox", {name: "Сервіс"}))
  expect(screen.getByRole("button", {name: "Прибрати «Сервіс»"})).toBeInTheDocument()
  expect(screen.getByRole("checkbox", {name: "Сервіс"})).toBeChecked()
  fireEvent.click(screen.getByRole("button", {name: "Прибрати «Сервіс»"}))
  expect(screen.queryByRole("button", {name: "Прибрати «Сервіс»"})).toBeNull()
  expect(screen.getByRole("checkbox", {name: "Сервіс"})).not.toBeChecked()
  fireEvent.click(screen.getByRole("checkbox", {name: "Сервіс"}))
  fireEvent.click(screen.getByRole("checkbox", {name: "Сервіс"}))
  expect(screen.queryByRole("button", {name: "Прибрати «Сервіс»"})).toBeNull()
})

it("moves with arrows and toggles with Enter, and closes on Escape and outside click", async () => {
  render(<PreviewDefaultsEditor />)
  const box = await openList()
  await screen.findByRole("checkbox", {name: "Сервіс"})
  fireEvent.keyDown(box, {key: "ArrowDown"})
  fireEvent.keyDown(box, {key: "ArrowDown"})
  fireEvent.keyDown(box, {key: "Enter"})
  expect(screen.getByRole("button", {name: "Прибрати «Сервіс»"})).toBeInTheDocument()
  fireEvent.keyDown(box, {key: " "})
  expect(screen.queryByRole("button", {name: "Прибрати «Сервіс»"})).toBeNull()
  fireEvent.keyDown(box, {key: "Escape"})
  expect(screen.queryByRole("listbox")).toBeNull()
  fireEvent.focus(box)
  expect(await screen.findByRole("listbox")).toBeInTheDocument()
  fireEvent.mouseDown(document.body)
  expect(screen.queryByRole("listbox")).toBeNull()
})

it("cannot select a muted row", async () => {
  api.catalog.mockResolvedValue([{ID: "e3", ExerciseVersionID: "v3", Name: "Чернетка", Infrastructure: false, Eligible: false, Reason: "not_published", Variants: []}])
  render(<PreviewDefaultsEditor />)
  const box = await openList()
  const row = await screen.findByText("Чернетка")
  fireEvent.click(row)
  fireEvent.keyDown(box, {key: "ArrowDown"})
  fireEvent.keyDown(box, {key: "Enter"})
  expect(screen.getAllByRole("listitem").some(item => item.textContent?.includes("Чернетка"))).toBe(false)
  expect(screen.getByRole("option", {name: /Чернетка/})).toHaveAttribute("aria-disabled", "true")
})

it("shows the empty state inside the dropdown only when nothing matches", async () => {
  api.catalog.mockResolvedValue([])
  render(<PreviewDefaultsEditor />)
  await openList()
  expect(await within(screen.getByRole("listbox")).findByText("Завдань не знайдено.")).toBeInTheDocument()
})
