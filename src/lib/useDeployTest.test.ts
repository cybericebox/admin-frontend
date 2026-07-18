import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"

import { useDeployTest } from "./useDeployTest"
import * as deployApi from "@/api/exercises/deploy"

vi.mock("@/api/exercises/deploy")

const mocked = vi.mocked(deployApi)

describe("useDeployTest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.destroyDeploy.mockResolvedValue(undefined)
  })

  it("starts a deploy and reflects a Ready status", async () => {
    mocked.deployVariant.mockResolvedValue({ DeployID: "g1", Lab: "lab" })
    mocked.deployStatus.mockResolvedValue({ Phase: "Ready", Ready: true, VPNCIDR: "10.128.1.0/24" })

    const { result } = renderHook(() => useDeployTest())
    await act(async () => {
      await result.current.start("ex", "ver", "var")
    })

    await waitFor(() => expect(result.current.status?.Ready).toBe(true))
    expect(result.current.deployId).toBe("g1")
    expect(result.current.busy).toBe(false)
    expect(mocked.deployVariant).toHaveBeenCalledWith("ex", "ver", "var")
  })

  it("surfaces a deploy error without a deploy id", async () => {
    mocked.deployVariant.mockRejectedValue(new Error("no infra"))

    const { result } = renderHook(() => useDeployTest())
    await act(async () => {
      await result.current.start("ex", "ver", "var")
    })

    await waitFor(() => expect(result.current.error).toBe("no infra"))
    expect(result.current.deployId).toBeNull()
    expect(result.current.busy).toBe(false)
  })

  it("tears the deploy down on close", async () => {
    mocked.deployVariant.mockResolvedValue({ DeployID: "g1", Lab: "lab" })
    mocked.deployStatus.mockResolvedValue({ Phase: "Ready", Ready: true })
    mocked.destroyDeploy.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeployTest())
    await act(async () => {
      await result.current.start("ex", "ver", "var")
    })
    await waitFor(() => expect(result.current.deployId).toBe("g1"))

    act(() => {
      result.current.close()
    })
    expect(mocked.destroyDeploy).toHaveBeenCalledWith("g1")
    expect(result.current.deployId).toBeNull()
  })
})
