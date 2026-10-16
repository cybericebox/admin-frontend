import { apiGet, apiPut } from "./client"

export type PreviewSelection = { ID?: string; ExerciseVersionID: string; VariantID: string; Name?: string; VariantIndex?: number }
export type PreviewSettings = { Inherit: boolean; GroupName: string; GroupNameOverride: string | null; Selections: PreviewSelection[]; EffectiveSelections: PreviewSelection[] }
export type PreviewDefaultsDraft = Pick<PreviewSettings, "GroupName" | "Selections">
export type PreviewCatalogItem = { ID: string; ExerciseVersionID: string; Name: string; Infrastructure: boolean; Variants: { ID: string; Index: number }[] }
export const previewSettingsKey = ["platform-participant-preview-settings"] as const
export const getPreviewSettings = () => apiGet<PreviewSettings>("/api/settings/participant-preview")
export const savePreviewSettings = ({ GroupName, Selections }: PreviewDefaultsDraft) => apiPut<PreviewSettings>("/api/settings/participant-preview", { GroupName, Selections: Selections.map(({ ExerciseVersionID, VariantID }) => ({ ExerciseVersionID, VariantID })) })
export const getPreviewCatalog = (search: string) => apiGet<PreviewCatalogItem[]>(`/api/settings/participant-preview/catalog?search=${encodeURIComponent(search)}`)
export const previewSelectionIdentity = (items: PreviewSelection[]) => JSON.stringify(items.map(({ ExerciseVersionID, VariantID }) => [ExerciseVersionID, VariantID]))
