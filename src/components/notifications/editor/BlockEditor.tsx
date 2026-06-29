"use client";

/**
 * BlockEditor.tsx — Email body block editor.
 *
 * Ported from ai-tutor admin/notifications/email/[id]/page.tsx BlockEditor
 * sub-component and rewired for the CyberICEBox design system.
 *
 * STABLE KEYS: Each block gets a UUID stored in `keysRef` (a parallel string[]
 * that mirrors the `value` array).  All mutations (add / delete / reorder) update
 * `keysRef.current` BEFORE calling `onChange`, so the next render sees matched
 * lengths.  Keys are NEVER derived from content or array index, so reordering
 * preserves the mounted RichTextEditor state (Lexical is mount-initialised /
 * uncontrolled after mount).
 */

import React, { useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Save } from "lucide-react";

import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/notifications/editor/RichTextEditor";
import { ColorPicker } from "@/components/notifications/editor/ColorPicker";
import {
  defaultBlockForType,
  type EmailBodyBlock,
  type ButtonBlock,
  type ImageBlock,
  type PresetBlock,
} from "@/components/notifications/editor/previewHtml";
import type { VariableDef } from "@/components/notifications/editor/variableUtils";
import type { BlockPreset } from "@/api/notifications/emailTemplates";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlockEditorProps = {
  value: EmailBodyBlock[];
  onChange: (blocks: EmailBodyBlock[]) => void;
  variables?: VariableDef[];
  presets: BlockPreset[];
  onSavePreset: (blocks: EmailBodyBlock[], name: string) => Promise<void>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const BLOCK_LABELS: Record<EmailBodyBlock["type"], string> = {
  rich_text: "Text",
  button: "Button",
  image: "Image",
  divider: "Divider",
  preset: "Preset",
};

const BLOCK_PILL_STYLES: Record<EmailBodyBlock["type"], string> = {
  rich_text: "bg-teal-100 text-teal-800",
  button:    "bg-amber-100 text-amber-800",
  image:     "bg-rose-100 text-rose-800",
  divider:   "bg-muted text-muted-foreground",
  preset:    "bg-teal-100 text-teal-800",
};

const ADD_BLOCK_TYPES: Array<EmailBodyBlock["type"]> = [
  "rich_text",
  "button",
  "image",
  "divider",
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
}: BlockEditorProps) {
  // ── Stable keys (parallel to value[]) ────────────────────────────────────
  // Sync length during render — all self-mutations update keysRef BEFORE onChange.
  const keysRef = useRef<string[]>([]);

  // Grow
  while (keysRef.current.length < value.length) {
    keysRef.current.push(newKey());
  }
  // Shrink (handles parent-initiated resets)
  if (keysRef.current.length > value.length) {
    keysRef.current = keysRef.current.slice(0, value.length);
  }

  // ── Selection + save-as-preset state ──────────────────────────────────────
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set());
  const [showSaveForm, setShowSaveForm]   = useState(false);
  const [presetName, setPresetName]       = useState("");
  const [savingPreset, setSavingPreset]   = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addBlock = (type: EmailBodyBlock["type"]) => {
    const block = defaultBlockForType(type);
    keysRef.current = [...keysRef.current, newKey()];
    onChange([...value, block]);
  };

  const addPresetBlock = (preset: BlockPreset) => {
    const block: PresetBlock = {
      type: "preset",
      preset_id: preset.ID,
      name: preset.Name,
    };
    keysRef.current = [...keysRef.current, newKey()];
    onChange([...value, block]);
  };

  const updateBlock = (i: number, updated: EmailBodyBlock) => {
    onChange(value.map((b, idx) => (idx === i ? updated : b)));
  };

  const removeBlock = (i: number) => {
    keysRef.current = keysRef.current.filter((_, idx) => idx !== i);
    onChange(value.filter((_, idx) => idx !== i));
    setSelectedIdxs(new Set());
  };

  const moveBlock = (i: number, dir: "up" | "down") => {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= value.length) return;

    const nextBlocks = [...value];
    const nextKeys   = [...keysRef.current];

    [nextBlocks[i], nextBlocks[j]] = [nextBlocks[j], nextBlocks[i]];
    [nextKeys[i],   nextKeys[j]]   = [nextKeys[j],   nextKeys[i]];

    keysRef.current = nextKeys;
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
      {selectedIdxs.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-foreground text-background px-4 py-2.5">
          <span className="text-sm font-medium flex-1">
            {selectedIdxs.size} block{selectedIdxs.size !== 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={() => { setSelectedIdxs(new Set()); setShowSaveForm(false); }}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Clear
          </button>

          {!showSaveForm ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowSaveForm(true)}
              aria-label="Save as preset"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save as preset
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name…"
                className="h-7 w-40 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") void handleSavePreset(); }}
              />
              <Button
                type="button"
                size="sm"
                disabled={savingPreset || !presetName.trim()}
                onClick={() => void handleSavePreset()}
                aria-label="Save"
              >
                {savingPreset ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelSaveForm}
                aria-label="Cancel"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Block list ── */}
      {value.map((block, i) => {
        // keysRef is guaranteed synced (while loop above)
        const stableKey = keysRef.current[i];

        return (
          <div
            key={stableKey}
            data-testid="block-item"
            className={cn(
              "group rounded-xl border p-4",
              block.type === "preset"
                ? "border-teal-200 bg-teal-50/30"
                : "border-border bg-white"
            )}
          >
            {/* Block header row */}
            <div className="flex items-center gap-2 mb-3">
              {/* Selection checkbox */}
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIdxs.has(i)}
                  onChange={(e) => {
                    const next = new Set(selectedIdxs);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    setSelectedIdxs(next);
                  }}
                  className="rounded"
                />
              </label>

              {/* Type pill */}
              <div className="flex-1">
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    BLOCK_PILL_STYLES[block.type] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {BLOCK_LABELS[block.type] ?? block.type}
                </span>
              </div>

              {/* Move + remove controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveBlock(i, "up")}
                  disabled={i === 0}
                  aria-label="Move block up"
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(i, "down")}
                  disabled={i === value.length - 1}
                  aria-label="Move block down"
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  aria-label="Remove block"
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── Block body ── */}

            {block.type === "rich_text" && (
              <RichTextEditor
                value={block.content}
                onChange={(state) =>
                  updateBlock(i, {
                    ...block,
                    content: state as typeof block.content,
                  })
                }
                variables={variables}
                placeholder="Type text, use {{variable}}, or format with the toolbar…"
              />
            )}

            {block.type === "button" && (
              <div className="space-y-2">
                <Input
                  value={(block as ButtonBlock).label}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ButtonBlock), label: e.target.value })
                  }
                  placeholder="Button label…"
                />
                <Input
                  value={(block as ButtonBlock).url}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ButtonBlock), url: e.target.value })
                  }
                  placeholder="https://…"
                />
                {/* ColorPicker for button background color (visual styling) */}
                <ColorPicker
                  value="#4F46E5"
                  onChange={() => {
                    // TODO: wire bg_color to ButtonBlock when backend supports it
                  }}
                  label="Button color"
                />
              </div>
            )}

            {block.type === "divider" && (
              <div className="border-t border-border my-1" aria-hidden />
            )}

            {block.type === "image" && (
              <div className="space-y-2">
                {/* Plain URL input — spec drops media library */}
                <Input
                  value={(block as ImageBlock).url ?? ""}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ImageBlock), url: e.target.value })
                  }
                  placeholder="https://example.com/image.png"
                />
                <Input
                  value={(block as ImageBlock).alt ?? ""}
                  onChange={(e) =>
                    updateBlock(i, { ...(block as ImageBlock), alt: e.target.value })
                  }
                  placeholder="Alt text…"
                />
              </div>
            )}

            {block.type === "preset" && (
              <div>
                <select
                  value={(block as PresetBlock).preset_id}
                  onChange={(e) => {
                    const preset = presets.find((p) => p.ID === e.target.value);
                    if (!preset) return;
                    updateBlock(i, {
                      type: "preset",
                      preset_id: preset.ID,
                      name: preset.Name,
                    });
                  }}
                  className="w-full rounded border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select a preset…</option>
                  {presets.map((p) => (
                    <option key={p.ID} value={p.ID}>
                      {p.Name} · {p.Blocks.length} blocks
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add block tray ── */}
      <div className="mt-4 rounded-xl border border-dashed border-border p-4">
        <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground mb-3">
          Add block
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {ADD_BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-label={`Add ${BLOCK_LABELS[type]} block`}
              onClick={() => addBlock(type)}
              className="px-2.5 py-1 rounded text-xs font-medium border border-border bg-white hover:bg-muted transition-colors"
            >
              {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>

        {presets.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground mb-2">
              Shared presets
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.ID}
                  type="button"
                  onClick={() => addPresetBlock(preset)}
                  className="px-2.5 py-1 rounded text-xs font-medium border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
                >
                  {preset.Name} · {preset.Blocks.length} blocks
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
