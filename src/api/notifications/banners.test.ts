import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiGet } from "@/api/client"
import { fetchSiteBanners } from "./banners"

vi.mock("@/api/client")

describe("admin public banners", () => {
  beforeEach(() => vi.clearAllMocks())

  it("identifies the admin render site and handles a null list", async () => {
    vi.mocked(apiGet).mockResolvedValue(null)
    expect(await fetchSiteBanners()).toEqual([])
    expect(apiGet).toHaveBeenCalledWith("/api/notifications/banners?site=admin")
  })

  it("falls back to the title for a personal banner without text", async () => {
    vi.mocked(apiGet).mockResolvedValue([{ ID: "p", Kind: "personal", Title: "Заголовок", Text: "" }])
    expect((await fetchSiteBanners())[0].Text).toBe("Заголовок")
  })
})
