// Minimal fetch-based API client.
// Base URL is same-origin by default; the daemon proxies /api/* paths.
// Override via NEXT_PUBLIC_API_BASE_URL env var for local development.

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string
  ) {
    super(message ?? `API error ${status}`)
    this.name = "ApiError"
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  let parsed: unknown
  const contentType = res.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    parsed = await res.json()
  } else {
    parsed = await res.text()
  }

  if (!res.ok) {
    throw new ApiError(res.status, parsed)
  }

  return parsed as T
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "GET" })
}

export function apiPost<T>(
  path: string,
  body: unknown,
  init?: RequestInit
): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function apiPut<T>(
  path: string,
  body: unknown,
  init?: RequestInit
): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function apiPatch<T>(
  path: string,
  body: unknown,
  init?: RequestInit
): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "DELETE" })
}
