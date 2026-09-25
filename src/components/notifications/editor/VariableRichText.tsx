"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  htmlToRawSingleLine,
  insertVariablePill,
  rawToHtml,
  type VariableDef,
} from "./variableUtils";
import { cn } from "@/utils/cn";
import { t } from "@/i18n/t";
import { Braces, ChevronDown } from "lucide-react";
import { historyDirection, placeCaretAtEnd, TemplateFieldHistory } from "./templateFieldHistory";

interface Props {
  value: string;
  onChange: (v: string) => void;
  variables?: VariableDef[];
  placeholder?: string;
  className?: string;
  /** When true, emits/parses {{.Name}} (Go text/template dotted form).
   *  When false (default), emits/parses {{Name}} (bare form). */
  dotted?: boolean;
}

export function VariableRichText({
  value,
  onChange,
  variables = [],
  placeholder,
  className,
  dotted = false,
}: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Track the last raw value we emitted so we avoid re-syncing innerHTML on
  // our own changes (which would clobber the caret position).
  const lastRawRef = useRef<string>("");
  const lastVariableNamesRef = useRef<string>("");
  const historyRef = useRef(new TemplateFieldHistory(value));

  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState("");
  // Save selection before a dropdown click steals focus
  const savedRangeRef = useRef<Range | null>(null);

  // Sync external value → innerHTML (skips when value came from our own onChange)
  useEffect(() => {
    if (!divRef.current) return;
    const varNames = variables.map((v) => v.name);
    const variableNames = varNames.join("\u0000");
    if (value === lastRawRef.current && variableNames === lastVariableNamesRef.current) return;
    const html = rawToHtml(value, varNames, { dotted });
    divRef.current.innerHTML = html;
    if (value !== lastRawRef.current) historyRef.current.reset(value);
    lastRawRef.current = value;
    lastVariableNamesRef.current = variableNames;
  }, [value, variables, dotted]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handle = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showDropdown]);

  const filteredVars = filter
    ? variables.filter((v) =>
        v.name.toLowerCase().startsWith(filter.toLowerCase())
      )
    : variables;

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const raw = htmlToRawSingleLine(e.currentTarget.innerHTML, { dotted });
    historyRef.current.record(raw);
    lastRawRef.current = raw;
    onChange(raw);

    // Detect {{ trigger for autocomplete
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) {
      setShowDropdown(false);
      return;
    }
    const text = sel.anchorNode.textContent ?? "";
    const before = text.slice(0, sel.anchorOffset);
    const match = before.match(/\{\{(\w*)$/);
    if (match) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      setFilter(match[1]);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const direction = historyDirection(e);
    if (direction && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const previous = historyRef.current[direction]();
      if (previous !== null && divRef.current) {
        divRef.current.innerHTML = rawToHtml(previous, variables.map((variable) => variable.name), { dotted });
        lastRawRef.current = previous;
        savedRangeRef.current = placeCaretAtEnd(divRef.current);
        onChange(previous);
      }
      setShowDropdown(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleInsert = useCallback(
    (name: string) => {
      const div = divRef.current;
      if (!div) return;

      // Restore selection lost to dropdown click
      const sel = window.getSelection();
      if (savedRangeRef.current && sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }

      if (!insertVariablePill(name)) {
        const pill = document.createElement("span");
        pill.className = "var-pill";
        pill.dataset.var = name;
        pill.contentEditable = "false";
        pill.textContent = name;
        const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
        if (range && div.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(pill);
          range.setStartAfter(pill);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } else {
          div.appendChild(pill);
        }
      }
      const raw = htmlToRawSingleLine(div.innerHTML, { dotted });
      historyRef.current.record(raw);
      lastRawRef.current = raw;
      onChange(raw);
      setShowDropdown(false);
    },
    [dotted, onChange]
  );

  return (
    <div className="relative" ref={containerRef}>
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={() => { const selection = window.getSelection(); if (selection?.rangeCount) savedRangeRef.current = selection.getRangeAt(0).cloneRange() }}
        onMouseUp={() => { const selection = window.getSelection(); if (selection?.rangeCount) savedRangeRef.current = selection.getRangeAt(0).cloneRange() }}
        data-placeholder={placeholder}
        className={cn(
          "variable-richtext min-h-[2rem] px-3 py-1.5 text-sm rounded-md border border-input bg-background text-foreground",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "[&_.var-pill]:mx-0.5 [&_.var-pill]:rounded [&_.var-pill]:border [&_.var-pill]:border-amber-300 [&_.var-pill]:bg-amber-100 [&_.var-pill]:px-1 [&_.var-pill]:text-amber-950 dark:[&_.var-pill]:border-amber-700 dark:[&_.var-pill]:bg-amber-900/40 dark:[&_.var-pill]:text-amber-200",
          "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none",
          variables.length > 0 && "pr-11",
          className
        )}
        role="textbox"
        aria-multiline="false"
      />
      {variables.length > 0 && <button type="button" aria-label={t("admin.notif.editor.insertVariable")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { setFilter(""); setShowDropdown((open) => !open) }}
        className="absolute right-1 top-1 inline-flex h-7 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-primary hover:bg-accent"><Braces className="h-3.5 w-3.5" /><ChevronDown className="h-3 w-3" /></button>}
      {showDropdown && filteredVars.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-[240px] overflow-y-auto py-1 rounded-lg bg-popover border border-input shadow-lg">
          {filteredVars.map((v) => (
            <button
              key={v.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before insert
                handleInsert(v.name);
              }}
              className="block w-full text-left px-3 py-1.5 hover:bg-secondary/40 transition-colors"
            >
              <span className="text-xs font-mono text-foreground">{`{{${dotted ? "." : ""}${v.name}}}`}</span>
              {v.description && (
                <span className="block text-[10px] font-sans text-muted-foreground mt-0.5">
                  {v.description}
                </span>
              )}
              {v.example && <span className="block text-[10px] font-sans text-muted-foreground">{t("admin.notif.editor.variableExample")}: {v.example}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default VariableRichText;
