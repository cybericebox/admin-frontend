import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider, toast, toastApiError } from "./toast"
import { ApiError } from "@/api/client"

function Actions() {
  return <>
    <button onClick={() => toast.success("Збережено")}>Save</button>
    <button onClick={() => toast.error("Не вдалося зберегти")}>Fail</button>
    <button onClick={() => toast.warning("Збережено частково")}>Warn</button>
  </>
}

describe("ToastProvider", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("shows action results as dismissible, accessible toasts in a named region", () => {
    render(<ToastProvider><Actions /></ToastProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    fireEvent.click(screen.getByRole("button", { name: "Fail" }))
    fireEvent.click(screen.getByRole("button", { name: "Warn" }))

    expect(screen.getByRole("region", { name: "Повідомлення про дії" })).toHaveClass("fixed", "left-1/2", "top-4", "-translate-x-1/2")
    expect(screen.getByRole("status")).toHaveTextContent("Збережено")
    expect(screen.getAllByRole("alert")).toHaveLength(2)
    expect(screen.getByText("Збережено").closest("[data-tone]")).toHaveAttribute("data-tone", "success")
    expect(screen.getByText("Не вдалося зберегти").closest("[data-tone]")).toHaveAttribute("data-tone", "error")
    expect(screen.getByText("Збережено частково").closest("[data-tone]")).toHaveAttribute("data-tone", "warning")
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Закрити сповіщення" }))
    expect(screen.queryByText("Збережено", { exact: true })).not.toBeInTheDocument()
  })

  it("expires a success toast after 5 s and a warning after 8 s, but keeps an error until it is closed", () => {
    render(<ToastProvider><Actions /></ToastProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    fireEvent.click(screen.getByRole("button", { name: "Warn" }))
    fireEvent.click(screen.getByRole("button", { name: "Fail" }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText("Збережено", { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText("Збережено частково")).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText("Збережено частково")).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(screen.getByText("Не вдалося зберегти")).toBeInTheDocument()
  })

  it("pauses the timer while the pointer is over the toast or focus is inside it", () => {
    render(<ToastProvider><Actions /></ToastProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    const item = screen.getByRole("status")
    act(() => { vi.advanceTimersByTime(3000) })
    fireEvent.pointerEnter(item)
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(screen.getByText("Збережено")).toBeInTheDocument()
    fireEvent.pointerLeave(item)
    act(() => { vi.advanceTimersByTime(4999) })
    expect(screen.getByText("Збережено")).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByText("Збережено", { exact: true })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    fireEvent.focus(within(screen.getByRole("status")).getByRole("button", { name: "Закрити сповіщення" }))
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(screen.getByText("Збережено")).toBeInTheDocument()
  })

  it("offers «Спробувати ще раз» on an overload error and runs the retry once, closing the toast", () => {
    const retry = vi.fn()
    render(<ToastProvider><button onClick={() => toastApiError(new ApiError(503, null), retry)}>Busy</button></ToastProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Busy" }))
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Сервер перевантажений, спробуйте за кілька секунд")
    fireEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows no retry button for other errors or without a retry handler", () => {
    render(<ToastProvider>
      <button onClick={() => toastApiError(new ApiError(500, null), vi.fn())}>Broken</button>
      <button onClick={() => toastApiError(new ApiError(503, null))}>Busy</button>
    </ToastProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Broken" }))
    fireEvent.click(screen.getByRole("button", { name: "Busy" }))
    expect(screen.getAllByRole("alert")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Спробувати ще раз" })).not.toBeInTheDocument()
  })
})
