/**
 * settings.ts — the platform image registry («Сховище образів»).
 *
 * Routes:
 *   GET    /api/settings/image-registry               (platform.settings.read)
 *   PUT    /api/settings/image-registry               save (platform.settings.write)
 *   DELETE /api/settings/image-registry               disconnect, returns the cleared view
 *   POST   /api/settings/image-registry/repositories  list the repositories a token can see
 *
 * Tokens are write-only: responses carry PushTokenSet / PullTokenSet only. A PUT with an
 * empty PushToken / PullToken keeps the stored one; ClearPullToken removes the pull token.
 */
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "@/api/client"

const BASE = "/api/settings/image-registry"

export type RegistryProvider = "dockerhub" | "ghcr"
export const REGISTRY_PROVIDERS: RegistryProvider[] = ["dockerhub", "ghcr"]

export type ImageRegistrySettings = {
  Configured: boolean
  Provider: RegistryProvider | ""
  Account: string
  Repository: string
  PushTokenSet: boolean
  PullTokenSet: boolean
  /** The platform secrets key is not set: tokens cannot be stored. */
  SecretsKeyMissing: boolean
  UpdatedAt: string | null
}

export type ImageRegistrySaveInput = {
  Provider: RegistryProvider
  Account: string
  Repository: string
  /** Empty keeps the stored token (same provider account). */
  PushToken: string
  PullToken: string
  ClearPullToken: boolean
}

export type ImageRegistryListInput = { Provider: RegistryProvider; Account: string; Token: string }

export function getImageRegistrySettings(): Promise<ImageRegistrySettings> {
  return apiGet<ImageRegistrySettings>(BASE)
}

export function saveImageRegistrySettings(input: ImageRegistrySaveInput): Promise<ImageRegistrySettings> {
  return apiPut<ImageRegistrySettings>(BASE, input)
}

export function clearImageRegistrySettings(): Promise<ImageRegistrySettings> {
  return apiDelete<ImageRegistrySettings>(BASE)
}

export async function listImageRegistryRepositories(input: ImageRegistryListInput): Promise<string[]> {
  const result = await apiPost<{ Repositories: string[] | null }>(`${BASE}/repositories`, input)
  return result?.Repositories ?? []
}

export type RegistryFailure = { reason: string; token: "push" | "pull" | "" }

/** The admin-visible failure of a registry call: Status.Context.reason / .token of the error. */
export function registryFailure(err: unknown): RegistryFailure | null {
  if (!(err instanceof ApiError)) return null
  const context = (err.body as { Status?: { Context?: { reason?: unknown; token?: unknown } } } | null)?.Status?.Context
  if (!context || typeof context.reason !== "string" || !context.reason) return null
  return { reason: context.reason, token: context.token === "push" || context.token === "pull" ? context.token : "" }
}
