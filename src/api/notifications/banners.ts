/**
 * banners.ts — site banners. Contract: docs/BROADCASTS.md, section «Банери».
 * Management (platform): /api/notifications/banners[/:id]
 * Public read (session optional): GET /api/banners → active, audience-filtered, critical first.
 */
import { apiDelete, apiGet, apiPost, apiPut } from '@/api/client'

const BASE = '/api/notifications/banners'

export type BannerLevel = 'info' | 'warning' | 'critical'
export type BannerAudience = 'everyone' | 'signed_in' | 'participants'

export type SiteBannerDTO = {
  ID: string
  Text: string
  LinkURL: string
  LinkLabel: string
  Level: BannerLevel
  Dismissible: boolean
  Version: string
}

export type Banner = {
  ID: string
  ScopeEventID?: string | null
  Text: string
  LinkURL: string
  LinkLabel: string
  Level: BannerLevel
  ActiveFrom: string | null
  ActiveTo: string | null
  Dismissible: boolean
  Audience: BannerAudience
  IsActive: boolean
  CreatedAt?: string
  UpdatedAt?: string
}

export type BannerInput = {
  Text: string
  LinkURL: string
  LinkLabel: string
  Level: BannerLevel
  ActiveFrom: string | null
  ActiveTo: string | null
  Dismissible: boolean
  Audience: BannerAudience
  IsActive: boolean
}

export const BANNER_TEXT_MAX = 280
export const BANNER_LABEL_MAX = 60

export function listBanners(): Promise<Banner[]> {
  return apiGet<Banner[] | null>(BASE).then((rows) => rows ?? [])
}

export function createBanner(input: BannerInput): Promise<Banner> {
  return apiPost<Banner>(BASE, input)
}

export function updateBanner(id: string, input: BannerInput): Promise<Banner> {
  return apiPut<Banner>(`${BASE}/${encodeURIComponent(id)}`, input)
}

export function deleteBanner(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${encodeURIComponent(id)}`)
}

/** Public banners for the render place (works without a session). */
export function fetchSiteBanners(): Promise<SiteBannerDTO[]> {
  return apiGet<SiteBannerDTO[] | null>('/api/banners').then((rows) => rows ?? [])
}
