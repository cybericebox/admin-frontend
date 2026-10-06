"use client";

/**
 * BlockEditor.tsx — Email body block editor.
 *
 * Ported from ai-tutor admin/notifications/email/[id]/page.tsx BlockEditor
 * sub-component and rewired for the CyberICEBox design system.
 *
 * STABLE KEYS: Each block gets a UUID stored alongside the controlled value.
 * All mutations (add / delete / reorder) update keys with `onChange`, so the next render sees matched
 * lengths.  Keys are NEVER derived from content or array index, so reordering
 * preserves the mounted RichTextEditor state (Lexical is mount-initialised /
 * uncontrolled after mount).
 */

import React, { useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Save, Upload } from "lucide-react";

import { cn } from "@/utils/cn";
import { t } from "@/i18n/t";
import { tPlural } from "@/i18n/plural";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { SelectMenu } from "@/components/ui/select-menu";
import { RichTextEditor } from "@/components/notifications/editor/RichTextEditor";
import { defaultBlockForType } from "@/components/notifications/editor/emailBlocks";
import type {
  EmailBodyBlock,
  ButtonBlock,
  ImageBlock,
  LogoBlock,
  FactsBlock,
  PresetBlock,
} from "@/components/notifications/editor/emailBlocks";
import type { VariableDef } from "@/components/notifications/editor/variableUtils";
import { uploadEmailImage, emailImageUrl } from "@/api/notifications/emailTemplates";
import type { BlockPreset } from "@/api/notifications/emailTemplates";
import { mediaUrl } from "@/api/client";
import { errorOr } from "@/i18n/apiError";
import { Checkbox } from "@/components/ui/checkbox";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlockEditorProps = {
  value: EmailBodyBlock[];
  onChange: (blocks: EmailBodyBlock[]) => void;
  variables?: VariableDef[];
  presets: BlockPreset[];
  onSavePreset: (blocks: EmailBodyBlock[], name: string) => Promise<void>;
  showPresetSave?: boolean;
  /** Block types that cannot be added (e.g. image for broadcasts, which have no image upload yet). */
  hiddenBlockTypes?: Array<EmailBodyBlock["type"]>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const BLOCK_LABEL_KEYS: Record<EmailBodyBlock["type"], string> = {
  rich_text: "admin.notif.editor.block.richText",
  button: "admin.notif.editor.block.button",
  image: "admin.notif.editor.block.image",
  divider: "admin.notif.editor.block.divider",
  preset: "admin.notif.editor.block.preset",
  logo: "admin.notif.editor.block.logo",
  facts: "admin.notif.editor.block.facts",
};

const ADD_BLOCK_ARIA_KEYS: Record<EmailBodyBlock["type"], string> = {
  rich_text: "admin.notif.editor.addTextBlock",
  button: "admin.notif.editor.addButtonBlock",
  image: "admin.notif.editor.addImageBlock",
  divider: "admin.notif.editor.addDividerBlock",
  preset: "admin.notif.editor.block.preset",
  logo: "admin.notif.editor.addLogoBlock",
  facts: "admin.notif.editor.addFactsBlock",
};

const BLOCK_PILL_STYLES: Record<EmailBodyBlock["type"], string> = {
  rich_text: "bg-primary/10 text-primary",
  button:    "bg-secondary text-secondary-foreground",
  image:     "bg-muted text-muted-foreground",
  divider:   "bg-muted text-muted-foreground",
  preset:    "bg-primary/10 text-primary",
  logo:      "bg-muted text-muted-foreground",
  facts:     "bg-muted text-muted-foreground",
};

const ADD_BLOCK_TYPES: Array<EmailBodyBlock["type"]> = [
  "rich_text",
  "button",
  "image",
  "divider",
  "logo",
  "facts",
];

// ── Key generation ────────────────────────────────────────────────────────────

function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BlockEditor({
  value,
  onChange,
  variables,
  presets,
  onSavePreset,
  showPresetSave = true,
  hiddenBlockTypes = [],
}: BlockEditorProps) {
  // Keys follow internal add/remove/reorder operations. For a parent-initiated
  // length change, adjust them before rendering children so mounted editors keep
  // their identity and no ref is read or mutated during render.
  const [keyState, setKeyState] = useState(() => ({ value, keys: value.map(newKey) }));
  if (keyState.value !== value) {
    setKeyState({
      value,
      keys: value.map((_, index) => keyState.keys[index] ?? newKey()),
    });
  }

  // "Latest" refs for the async upload continuation below: mutated directly in
  // the render body (not an effect — refs don't trigger re-renders, so there's
  // no cascading-update concern), so a completion handler that runs after
  // further renders (reorder / delete / other edits happened while the
  // request was in flight) reads the CURRENT value/keys, never a stale
  // snapshot closed over when the upload started.
  const latestValueRef = useRef(value);
  latestValueRef.current = value;
  const latestKeysRef = useRef(keyState.keys);
  latestKeysRef.current = keyState.keys;

  // ── Selection + save-as-preset state ──────────────────────────────────────
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set());
  const [showSaveForm, setShowSaveForm]   = useState(false);
  const [presetName, setPresetName]       = useState("");
  const [savingPreset, setSavingPreset]   = useState(false);

  // ── Image upload state (keyed by the block's stable key, not index, so it
  //    survives reordering) ─────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<Record<string, { uploading: boolean; error: string | null }>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Looks the block up by its stable key against the LATEST blocks/keys at
  // completion time — never by the index/block snapshot captured when the
  // upload started, which could be stale after a reorder, edit, or delete.
  const handleImageUpload = async (key: string, file: File) => {
    setUploadState((prev) => ({ ...prev, [key]: { uploading: true, error: null } }));
    try {
      const { FileID } = await uploadEmailImage(file);
      const idx = latestKeysRef.current.indexOf(key);
      const current = idx === -1 ? undefined : latestValueRef.current[idx];
      // Block gone (removed while uploading) or no longer an image block —
      // drop the result rather than write it somewhere wrong.
      if (current && current.type === "image") {
        const next = latestValueRef.current.map((b, i) =>
          i === idx ? { ...current, file_id: FileID, url: undefined } : b
        );
        onChange(next);
      }
      setUploadState((prev) => ({ ...prev, [key]: { uploading: false, error: null } }));
    } catch (err) {
      setUploadState((prev) => ({
        ...prev,
        [key]: { uploading: false, error: errorOr(err, t("admin.notif.tpl.saveError")) },
      }));
    }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addBlock = (type: EmailBodyBlock["type"]) => {
    const block = defaultBlockForType(type);
    const next = [...value, block];
    setKeyState({ value: next, keys: [...keyState.keys, newKey()] });
    onChange(next);
  };

  const addPresetBlock = (preset: BlockPreset) => {
    const block: PresetBlock = {
      type: "preset",
      preset_id: preset.ID,
      name: preset.Name,
    };
    const next = [...value, block];
    setKeyState({ value: next, keys: [...keyState.keys, newKey()] });
    onChange(next);
  };

  const updateBlock = (i: number, updated: EmailBodyBlock) => {
    onChange(value.map((b, idx) => (idx === i ? updated : b)));
  };

  const removeBlock = (i: number) => {
    const next = value.filter((_, idx) => idx !== i);
    setKeyState({ value: next, keys: keyState.keys.filter((_, idx) => idx !== i) });
    onChange(next);
    setSelectedIdxs(new Set());
  };

  const moveBlock = (i: number, dir: "up" | "down") => {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= value.length) return;

    const nextBlocks = [...value];
    const nextKeys   = [...keyState.keys];

    [nextBlocks[i], nextBlocks[j]] = [nextBlocks[j], nextBlocks[i]];
    [nextKeys[i],   nextKeys[j]]   = [nextKeys[j],   nextKeys[i]];

    setKeyState({ value: nextBlocks, keys: nextKeys });
    onChange(nextBlocks);
    setSelectedIdxs(new Set());
  };

  // ── Save-as-preset ────────────────────────────────────────────────────────

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    const selectedBlocks = value.filter((_, i) => selectedIdxs.has(i));
    setSavingPreset(true);
    try {
      await onSavePreset(selectedBlocks, presetName.trim());
      setShowSaveForm(false);
      setPresetName("");
      setSelectedIdxs(new Set());
    } catch (err) {
      toast.error(errorOr(err, t("admin.notif.tpl.saveError")));
    } finally {
      setSavingPreset(false);
    }
  };

  const cancelSaveForm = () => {
    setShowSaveForm(false);
    setPresetName("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Selection toolbar (appears when ≥1 block selected) ── */}
      {showPresetSave && selectedIdxs.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-foreground text-background px-4 py-2.5">
          <span className="text-sm font-medium flex-1">
            {t("admin.notif.editor.blocksSelectedN", { count: selectedIdxs.size })}
          </span>
          <button
            type="button"
            onClick={() => { setSelectedIdxs(new Set()); setShowSaveForm(false); }}
            className="text-xs opacity-70 hover:opacity-100"
          >
            {t("admin.notif.editor.clearSelection")}
          </button>

          {!showSaveForm ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowSaveForm(true)}
              aria-label={t("admin.notif.editor.savePreset")}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {t("admin.notif.editor.savePreset")}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t("admin.notif.editor.presetNamePlaceholder")}
                className="h-7 w-40 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") void handleSavePreset(); }}
              />
              <Button
                type="button"
                size="sm"
                busy={savingPreset}
                disabled={!presetName.trim()}
                onClick={() => void handleSavePreset()}
                aria-label={t("admin.notif.editor.save")}
              >
                {t("admin.notif.editor.save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelSaveForm}
                aria-label={t("admin.notif.editor.cancel")}
              >
                {t("admin.notif.editor.cancel")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Block list ── */}
      {value.map((block, i) => {
        const stableKey = keyState.keys[i];

        return (
          <div
            key={stableKey}
            data-testid="block-item"
            className={cn(
              "group rounded-xl border p-4",
              "border-border bg-card"
            )}
          >
            {/* Block header row */}
            <div className="flex items-center gap-2 mb-3">
              {/* Selection checkbox */}
              {showPresetSave && <Checkbox
                  checked={selectedIdxs.has(i)}
                  onChange={(e) => {
                    const next = new Set(selectedIdxs);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    setSelectedIdxs(next);
                  }}
                />}

              {/* Type pill */}
              <div className="flex-1">
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    BLOCK_PILL_STYLES[block.type] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {t(BLOCK_LABEL_KEYS[block.type] ?? block.type)}
                </span>
              </div>

              {/* Move + remove controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveBlock(i, "up")}
                  disabled={i === 0}
                  aria-label={t("admin.notif.editor.moveBlockUp")}
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(i, "down")}
                  disabled={i === value.length - 1}
                  aria-label={t("admin.notif.editor.moveBlockDown")}
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  aria-label={t("admin.notif.editor.removeBlock")}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── Block body ── */}

            {block.type === "rich_text" && (
              <RichTextEditor
                showVariableNames
                className="[&_[data-notif-variable]]:border-transparent [&_[data-notif-variable]]:bg-[var(--ib-warn-bg)] [&_[data-notif-variable]]:text-[var(--ib-warn)]"
                value={block.content}
                onChange={(state) =>
                  updateBlock(i, {
                    ...block,
                    content: state as typeof block.content,
                  })
                }
                variables={variables}
                placeholder={t("admin.notif.editor.richTextPlaceholder")}
              />
            )}

            {block.type === "button" && (
              <div className="space-y-2">
                <Input
                  value={(block as ButtonBlock).label}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ButtonBlock), label: e.target.value })
                  }
                  placeholder={t("admin.notif.editor.buttonLabelPlaceholder")}
                />
                <Input
                  value={(block as ButtonBlock).url}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ButtonBlock), url: e.target.value })
                  }
                  placeholder="https://…"
                />
                <label className="block text-sm">
                  <span className="text-muted-foreground">{t("admin.notif.editor.alignment")}</span>
                  <SelectMenu value={(block as ButtonBlock).align ?? "center"} onChange={(next) => updateBlock(i, { ...(block as ButtonBlock), align: next as "left" | "center" | "right" })} ariaLabel={t("admin.notif.editor.alignment")} options={[{ value: "left", label: t("admin.notif.editor.alignLeft") }, { value: "center", label: t("admin.notif.editor.alignCenter") }, { value: "right", label: t("admin.notif.editor.alignRight") }]} className="mt-1 w-full" />
                </label>
              </div>
            )}

            {block.type === "divider" && (
              <div className="border-t border-border my-1" aria-hidden />
            )}

            {block.type === "image" && (
              <div className="space-y-2">
                {/* Plain URL input, or upload a file — either sets file_id (clearing url)
                    or url (clearing file_id); the two are mutually exclusive. */}
                <Input
                  value={(block as ImageBlock).url ?? ""}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ImageBlock), url: e.target.value, file_id: undefined })
                  }
                  placeholder="https://example.com/image.png"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { fileInputRefs.current[stableKey] = el; }}
                    type="file"
                    accept="image/png,image/jpeg,image/gif"
                    data-testid="image-file-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleImageUpload(stableKey, file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    busy={uploadState[stableKey]?.uploading}
                    onClick={() => fileInputRefs.current[stableKey]?.click()}
                  >
                    {!uploadState[stableKey]?.uploading && <Upload className="h-3.5 w-3.5 mr-1.5" />}
                    {t("admin.notif.editor.uploadImage")}
                  </Button>
                  {(block as ImageBlock).file_id && (
                    <img
                      src={mediaUrl(emailImageUrl((block as ImageBlock).file_id!))}
                      alt=""
                      className="h-10 w-10 rounded-md border border-border object-cover"
                    />
                  )}
                </div>
                {uploadState[stableKey]?.error && (
                  <p className="text-xs text-destructive">{uploadState[stableKey]?.error}</p>
                )}
                <Input
                  value={(block as ImageBlock).alt ?? ""}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ImageBlock), alt: e.target.value })
                  }
                  placeholder={t("admin.notif.editor.altPlaceholder")}
                />
              </div>
            )}

            {block.type === "facts" && (
              <div className="space-y-2">
                {(block as FactsBlock).items.map((item, row) => (
                  <div key={row} className="flex items-center gap-2">
                    <Input
                      value={item.label}
                      aria-label={t("admin.notif.editor.factLabelPlaceholder")}
                      onChange={(e) => {
                        const items = (block as FactsBlock).items.map((it, k) => (k === row ? { ...it, label: e.target.value } : it));
                        updateBlock(i, { ...(block as FactsBlock), items });
                      }}
                      placeholder={t("admin.notif.editor.factLabelPlaceholder")}
                    />
                    <Input
                      value={item.value}
                      aria-label={t("admin.notif.editor.factValuePlaceholder")}
                      onChange={(e) => {
                        const items = (block as FactsBlock).items.map((it, k) => (k === row ? { ...it, value: e.target.value } : it));
                        updateBlock(i, { ...(block as FactsBlock), items });
                      }}
                      placeholder={t("admin.notif.editor.factValuePlaceholder")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t("admin.notif.editor.removeFactRow")}
                      onClick={() => {
                        const items = (block as FactsBlock).items.filter((_, k) => k !== row);
                        updateBlock(i, { ...(block as FactsBlock), items });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateBlock(i, { ...(block as FactsBlock), items: [...(block as FactsBlock).items, { label: "", value: "" }] })
                  }
                >
                  {t("admin.notif.editor.addFactRow")}
                </Button>
              </div>
            )}

            {block.type === "logo" && (
              <div className="space-y-2">
                <label className="block text-sm">
                  <span className="text-muted-foreground">{t("admin.notif.editor.alignment")}</span>
                  <SelectMenu
                    value={(block as LogoBlock).align ?? "center"}
                    onChange={(next) =>
                      updateBlock(i, { ...(block as LogoBlock), align: next as "left" | "center" | "right" })
                    }
                    ariaLabel={t("admin.notif.editor.alignment")}
                    options={[
                      { value: "left", label: t("admin.notif.editor.alignLeft") },
                      { value: "center", label: t("admin.notif.editor.alignCenter") },
                      { value: "right", label: t("admin.notif.editor.alignRight") },
                    ]}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">{t("admin.notif.editor.logoWidth")}</span>
                  <input
                    type="number"
                    min={16}
                    max={600}
                    aria-label={t("admin.notif.editor.logoWidth")}
                    value={(block as LogoBlock).width_px ?? 64}
                    onChange={(e) =>
                      updateBlock(i, { ...(block as LogoBlock), width_px: parseInt(e.target.value, 10) || 64 })
                    }
                    className={cn(
                      "mt-1 flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground",
                      "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    )}
                  />
                </label>
              </div>
            )}

            {block.type === "preset" && (
              <div>
                <SelectMenu
                  value={(block as PresetBlock).preset_id}
                  onChange={(next) => {
                    const preset = presets.find((p) => p.ID === next);
                    if (!preset) return;
                    updateBlock(i, {
                      type: "preset",
                      preset_id: preset.ID,
                      name: preset.Name,
                    });
                  }}
                  ariaLabel={t("admin.notif.editor.selectPreset")}
                  options={[{ value: "", label: t("admin.notif.editor.selectPreset") }, ...presets.map((p) => ({ value: p.ID, label: t("admin.notif.editor.presetOption", { name: p.Name, blocks: tPlural("admin.notif.editor.blocksCountN", p.Blocks.length) }) }))]}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add block tray ── */}
      <div className="mt-4 rounded-xl border border-dashed border-border p-4">
        <div className="text-xs font-semibold text-muted-foreground mb-3">
          {t("admin.notif.editor.addBlock")}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {ADD_BLOCK_TYPES.filter((type) => !hiddenBlockTypes.includes(type)).map((type) => (
            <button
              key={type}
              type="button"
              aria-label={t(ADD_BLOCK_ARIA_KEYS[type])}
              onClick={() => addBlock(type)}
              className="px-2.5 py-1 rounded text-xs font-medium border border-border bg-card hover:bg-muted transition-colors"
            >
              {t(BLOCK_LABEL_KEYS[type])}
            </button>
          ))}
        </div>

        {presets.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              {t("admin.notif.editor.sharedPresets")}
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.ID}
                  type="button"
                  onClick={() => addPresetBlock(preset)}
                  className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {t("admin.notif.editor.presetOption", { name: preset.Name, blocks: tPlural("admin.notif.editor.blocksCountN", preset.Blocks.length) })}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BlockEditor;
