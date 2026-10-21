/**
 * banners.ts — site banners. Contract: docs/BROADCASTS.md, section «Банери».
 * Management (platform): /api/notifications/site-banners[/:id]
 * Public read (session optional): GET /api/notifications/banners?site=admin → active, audience-filtered, critical first.
 * The list is refetched only when the pulse reports a new Banners version (lib/pulse).
 */
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/api/client'

const BASE = '/api/notifications/site-banners'

export type BannerLevel = 'info' | 'warning' | 'critical'
export type BannerTargetMode = 'all' | 'selected'
export type BannerTargetSite = 'main' | 'id' | 'admin' | 'exercises' | 'event'

export type BannerAudience = 'everyone' | 'signed_in' | 'participants'

export type BannerKind = 'site' | 'system' | 'personal'

export type SiteBannerDTO = {
  ID: string
  Kind: BannerKind
  Title?: string
  Text: string
  LinkURL: string
  LinkLabel: string
  Level: BannerLevel
  Dismissible: boolean
  Version: string | number
}

export type Banner = {
  ID: string
  ScopeEventID?: string | null
  TargetMode?: BannerTargetMode
  TargetSites?: BannerTargetSite[]
  TargetEventIDs?: string[]
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
  TargetMode?: BannerTargetMode
  TargetSites?: BannerTargetSite[]
  TargetEventIDs?: string[]
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
  return apiGet<SiteBannerDTO[] | null>('/api/notifications/banners?site=admin')
    .then((rows) => (rows ?? []).map((row) => (row.Kind === 'personal' && !row.Text ? { ...row, Text: row.Title ?? '' } : row)))
}

/** Dismiss a personal banner on the server (site and system banners are dismissed locally). */
export function dismissPersonalBanner(id: string): Promise<void> {
  return apiPatch<void>(`/api/notifications/banners/${encodeURIComponent(id)}/dismiss`, {})
}
