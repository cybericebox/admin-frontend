"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { $createCodeNode, $isCodeNode, CodeNode } from "@lexical/code";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { EditorState } from "lexical";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Pilcrow,
  RemoveFormatting,
  ChevronDown,
  Braces,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { t } from "@/i18n/t";
import { type VariableDef } from "./variableUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LexicalState = Record<string, unknown>;

export interface RichTextEditorProps {
  value: LexicalState | null;
  onChange: (state: LexicalState) => void;
  variables?: VariableDef[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// VariableNode — custom inline DecoratorNode for {{var}} pills
// ---------------------------------------------------------------------------

type SerializedVariableNode = Spread<{ varName: string }, SerializedLexicalNode>;

export class VariableNode extends DecoratorNode<JSX.Element> {
  __varName: string;

  static getType(): string {
    return "variable";
  }

  static clone(node: VariableNode): VariableNode {
    return new VariableNode(node.__varName, node.__key);
  }

  constructor(varName: string, key?: NodeKey) {
    super(key);
    this.__varName = varName;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.className =
      "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20";
    span.setAttribute("contenteditable", "false");
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const el = document.createElement("span");
    el.textContent = `{{${this.__varName}}}`;
    el.dataset.variable = this.__varName;
    return { element: el };
  }

  static importDOM(): DOMConversionMap {
    return {
      span: (node: Node) => {
        const el = node as HTMLSpanElement;
        if (!el.dataset?.variable) return null;
        return {
          conversion: (domNode: Node): DOMConversionOutput => {
            const span = domNode as HTMLSpanElement;
            return {
              node: $createVariableNode(span.dataset.variable ?? ""),
            };
          },
          priority: 1,
        };
      },
    };
  }

  exportJSON(): SerializedVariableNode {
    return {
      type: "variable",
      version: 1,
      varName: this.__varName,
    };
  }

  static importJSON(serialized: SerializedVariableNode): VariableNode {
    return $createVariableNode(serialized.varName);
  }

  decorate(): JSX.Element {
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20"
        contentEditable={false}
      >
        {`{{${this.__varName}}}`}
      </span>
    );
  }
}

export function $createVariableNode(varName: string): VariableNode {
  return new VariableNode(varName);
}

export function $isVariableNode(node: unknown): node is VariableNode {
  return node instanceof VariableNode;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}): JSX.Element {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 rounded-md bg-foreground px-2 py-1 text-[11px] leading-none text-background whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
      >
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolbarPlugin
// ---------------------------------------------------------------------------

type FormatType = "bold" | "italic" | "underline" | "strikethrough" | "code";

const ALIGN_FORMAT_MAP: Record<number, string> = {
  1: "left",
  2: "center",
  3: "right",
  4: "justify",
};

function ToolbarPlugin({
  variables,
}: {
  variables: VariableDef[];
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [formats, setFormats] = useState<Set<FormatType>>(new Set());
  const [blockType, setBlockType] = useState<string>("paragraph");
  const [alignment, setAlignment] = useState<string>("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showVarsMenu, setShowVarsMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const varsRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (varsRef.current && !varsRef.current.contains(e.target as Node)) {
        setShowVarsMenu(false);
      }
      if (
        headingRef.current &&
        !headingRef.current.contains(e.target as Node)
      ) {
        setShowHeadingMenu(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const active = new Set<FormatType>();
          if (selection.hasFormat("bold")) active.add("bold");
          if (selection.hasFormat("italic")) active.add("italic");
          if (selection.hasFormat("underline")) active.add("underline");
          if (selection.hasFormat("strikethrough")) active.add("strikethrough");
          if (selection.hasFormat("code")) active.add("code");
          setFormats(active);

          const anchorNode = selection.anchor.getNode();
          const element =
            anchorNode.getKey() === "root"
              ? anchorNode
              : anchorNode.getTopLevelElementOrThrow();

          if ($isHeadingNode(element)) {
            setBlockType(element.getTag());
          } else if ($isListNode(element)) {
            const parent = element.getParent();
            const listNode = $isListNode(parent) ? parent : element;
            setBlockType(listNode.getListType() === "number" ? "ol" : "ul");
          } else if ($isQuoteNode(element)) {
            setBlockType("quote");
          } else if ($isCodeNode(element)) {
            setBlockType("code");
          } else {
            setBlockType("paragraph");
          }

          const elemFmt =
            typeof (element as { getFormat?: () => number }).getFormat ===
            "function"
              ? (element as { getFormat: () => number }).getFormat()
              : 0;
          setAlignment(ALIGN_FORMAT_MAP[elemFmt] ?? "");
        });
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  const formatText = (format: FormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatBlock = useCallback(
    (type: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        if (type === "paragraph") {
          $setBlocksType(selection, () => $createParagraphNode());
        } else if (type === "h1") {
          $setBlocksType(selection, () => $createHeadingNode("h1"));
        } else if (type === "h2") {
          $setBlocksType(selection, () => $createHeadingNode("h2"));
        } else if (type === "h3") {
          $setBlocksType(selection, () => $createHeadingNode("h3"));
        } else if (type === "quote") {
          $setBlocksType(selection, () => $createQuoteNode());
        } else if (type === "code") {
          $setBlocksType(selection, () => $createCodeNode());
        }
      });

      if (type === "ul") {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      } else if (type === "ol") {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      }
    },
    [editor]
  );

  const insertList = useCallback(
    (listType: "ul" | "ol") => {
      if (blockType === listType) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      } else if (listType === "ul") {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      } else {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      }
    },
    [editor, blockType]
  );

  const clearFormatting = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      selection.getNodes().forEach((node) => {
        if (node instanceof TextNode) {
          node.setFormat(0);
        }
      });
    });
  }, [editor]);

  const insertVariable = useCallback(
    (varName: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const varNode = $createVariableNode(varName);
          const spaceNode = $createTextNode(" ");
          $insertNodes([varNode, spaceNode]);
        }
      });
      setShowVarsMenu(false);
    },
    [editor]
  );

  const handleLinkInsert = () => {
    if (!showLinkInput) {
      setShowLinkInput(true);
      setTimeout(() => linkInputRef.current?.focus(), 0);
      return;
    }
    if (linkUrl) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
    }
    setShowLinkInput(false);
    setLinkUrl("");
  };

  const btnBase =
    "inline-flex items-center justify-center w-7 h-7 rounded transition-colors";
  const btnInactive = cn(
    btnBase,
    "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
  );
  const btnActive = cn(btnBase, "bg-primary text-primary-foreground");

  const chipBase =
    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors";
  const chipInactive = cn(
    chipBase,
    "bg-secondary/40 text-foreground hover:bg-secondary/60"
  );
  const chipActiveStyle = cn(chipBase, "bg-primary text-primary-foreground");

  const isHeading =
    blockType === "h1" || blockType === "h2" || blockType === "h3";
  const headingLabel =
    blockType === "h1"
      ? "H1"
      : blockType === "h2"
        ? "H2"
        : blockType === "h3"
          ? "H3"
          : t("admin.notif.editor.heading");

  return (
    <div className="border-b border-input bg-muted/30">
      {/* Row 1 — inline formatting + actions */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2">
        <Tooltip label={t("admin.notif.editor.bold")}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              formatText("bold");
            }}
            className={formats.has("bold") ? btnActive : btnInactive}
          >
            <Bold size={14} aria-hidden />
          </button>
        </Tooltip>

        <Tooltip label={t("admin.notif.editor.italic")}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              formatText("italic");
            }}
            className={formats.has("italic") ? btnActive : btnInactive}
          >
            <Italic size={14} aria-hidden />
          </button>
        </Tooltip>

        <Tooltip label={t("admin.notif.editor.underline")}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              formatText("underline");
            }}
            className={formats.has("underline") ? btnActive : btnInactive}
          >
            <Underline size={14} aria-hidden />
          </button>
        </Tooltip>

        <Tooltip label={t("admin.notif.editor.strikethrough")}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              formatText("strikethrough");
            }}
            className={formats.has("strikethrough") ? btnActive : btnInactive}
          >
            <Strikethrough size={14} aria-hidden />
          </button>
        </Tooltip>

        <Tooltip label={t("admin.notif.editor.inlineCode")}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              formatText("code");
            }}
            className={formats.has("code") ? btnActive : btnInactive}
          >
            <Code size={14} aria-hidden />
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {(
          [
            { value: "left", title: t("admin.notif.editor.alignLeftTitle"), Icon: AlignLeft },
            { value: "center", title: t("admin.notif.editor.alignCenterTitle"), Icon: AlignCenter },
            { value: "right", title: t("admin.notif.editor.alignRightTitle"), Icon: AlignRight },
          ] as const
        ).map(({ value: alignValue, title, Icon }) => (
          <Tooltip key={alignValue} label={title}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignValue);
              }}
              className={alignment === alignValue ? btnActive : btnInactive}
            >
              <Icon size={14} aria-hidden />
            </button>
          </Tooltip>
        ))}

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        <Tooltip label={t("admin.notif.editor.blockquote")}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              formatBlock("quote");
            }}
            className={blockType === "quote" ? btnActive : btnInactive}
          >
            <Quote size={14} aria-hidden />
          </button>
        </Tooltip>

        <div className="relative flex items-center gap-1">
          <Tooltip label={t("admin.notif.editor.insertLink")}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleLinkInsert();
              }}
              className={showLinkInput ? btnActive : btnInactive}
            >
              <Link size={14} aria-hidden />
            </button>
          </Tooltip>
          {showLinkInput && (
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLinkInsert();
                }
                if (e.key === "Escape") {
                  setShowLinkInput(false);
                  setLinkUrl("");
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowLinkInput(false);
                  setLinkUrl("");
                }, 150);
              }}
              placeholder="https://…"
              className="text-xs border border-input rounded px-2 py-0.5 w-44 outline-none focus:border-primary bg-background text-foreground"
            />
          )}
        </div>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        <Tooltip label={t("admin.notif.editor.clearFormatting")}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              clearFormatting();
            }}
            className={btnInactive}
          >
            <RemoveFormatting size={14} aria-hidden />
          </button>
        </Tooltip>

        {variables.length > 0 && (
          <>
            <div className="w-px h-5 bg-border mx-1 shrink-0" />
            <div className="relative" ref={varsRef}>
              <Tooltip label={t("admin.notif.editor.insertVariable")}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowVarsMenu((v) => !v);
                  }}
                  className={cn(
                    showVarsMenu ? btnActive : btnInactive,
                    "gap-0.5"
                  )}
                >
                  <Braces size={14} aria-hidden />
                  <ChevronDown size={9} aria-hidden />
                </button>
              </Tooltip>
              {showVarsMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] max-h-[240px] overflow-y-auto bg-popover rounded-xl border border-input shadow-md py-1">
                  {variables.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertVariable(v.name);
                      }}
                      className="block w-full text-left px-3 py-1.5 text-foreground hover:bg-secondary/40 transition-colors"
                    >
                      <span className="text-xs font-mono">{`{{${v.name}}}`}</span>
                      {v.description && (
                        <span className="block text-[10px] font-sans text-muted-foreground mt-0.5">
                          {v.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Row 2 — block types */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-input">
        <div className="relative" ref={headingRef}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowHeadingMenu((v) => !v);
            }}
            className={isHeading ? chipActiveStyle : chipInactive}
          >
            <Heading1 size={12} aria-hidden />
            {headingLabel}
            <ChevronDown size={10} aria-hidden />
          </button>
          {showHeadingMenu && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-popover rounded-xl border border-input shadow-md py-1 min-w-[120px]">
              {(
                [
                  { tag: "h1" as const, Icon: Heading1, label: t("admin.notif.editor.heading1") },
                  { tag: "h2" as const, Icon: Heading2, label: t("admin.notif.editor.heading2") },
                  { tag: "h3" as const, Icon: Heading3, label: t("admin.notif.editor.heading3") },
                ] as const
              ).map(({ tag, Icon, label }) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    formatBlock(tag);
                    setShowHeadingMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs font-semibold transition-colors",
                    blockType === tag
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary/40"
                  )}
                >
                  <Icon size={12} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            formatBlock("paragraph");
          }}
          className={blockType === "paragraph" ? chipActiveStyle : chipInactive}
        >
          <Pilcrow size={12} aria-hidden />
          {t("admin.notif.editor.paragraph")}
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            insertList("ul");
          }}
          className={blockType === "ul" ? chipActiveStyle : chipInactive}
        >
          <List size={12} aria-hidden />
          {t("admin.notif.editor.bulletList")}
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            insertList("ol");
          }}
          className={blockType === "ol" ? chipActiveStyle : chipInactive}
        >
          <ListOrdered size={12} aria-hidden />
          {t("admin.notif.editor.numberedList")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariablePlugin — {{var}} typeahead
// ---------------------------------------------------------------------------

class VariableMenuOption extends MenuOption {
  varName: string;
  description: string;

  constructor(varName: string, description: string = "") {
    super(varName);
    this.varName = varName;
    this.description = description;
  }
}

interface VariablePluginProps {
  variables: VariableDef[];
}

function VariablePlugin({ variables }: VariablePluginProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  // Matches literal {{ followed by optional word chars at end of text
  const triggerFn = useCallback(
    (
      text: string
    ): {
      leadOffset: number;
      matchingString: string;
      replaceableString: string;
    } | null => {
      const match = /\{\{(\w*)$/.exec(text);
      if (!match) return null;
      return {
        leadOffset: match.index,
        matchingString: match[1],
        replaceableString: match[0],
      };
    },
    []
  );

  const options: VariableMenuOption[] = (
    queryString != null
      ? variables.filter((v) =>
          v.name.toLowerCase().startsWith(queryString.toLowerCase())
        )
      : variables
  ).map((v) => new VariableMenuOption(v.name, v.description ?? ""));

  const onSelectOption = useCallback(
    (
      option: VariableMenuOption,
      textNodeContainingQuery: import("lexical").TextNode | null,
      closeMenu: () => void
    ) => {
      editor.update(() => {
        if (textNodeContainingQuery) {
          textNodeContainingQuery.remove();
        }
        const varNode = $createVariableNode(option.varName);
        const spaceNode = $createTextNode(" ");
        $insertNodes([varNode, spaceNode]);
      });
      closeMenu();
    },
    [editor]
  );

  const menuRenderFn: (
    anchorElementRef: RefObject<HTMLElement | null>,
    itemProps: {
      selectedIndex: number | null;
      selectOptionAndCleanUp: (option: VariableMenuOption) => void;
      setHighlightedIndex: (index: number) => void;
      options: VariableMenuOption[];
    },
    matchingString: string
  ) => JSX.Element | null = (
    anchorElementRef,
    { selectedIndex, selectOptionAndCleanUp, options: menuOptions }
  ) => {
    if (menuOptions.length === 0 || !anchorElementRef.current) return null;
    const rect = anchorElementRef.current.getBoundingClientRect();
    return createPortal(
      <div
        className="fixed z-[9999] min-w-[200px] max-h-[240px] overflow-y-auto py-1 rounded-lg bg-popover border border-input shadow-lg"
        style={{ top: rect.bottom + 4, left: rect.left }}
      >
        {menuOptions.map((opt, idx) => (
          <button
            key={opt.key}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              selectOptionAndCleanUp(opt);
            }}
            className={cn(
              "block w-full text-left px-3 py-1.5 transition-colors",
              selectedIndex === idx
                ? "bg-secondary/60"
                : "hover:bg-secondary/40"
            )}
          >
            <span className="text-xs font-mono text-foreground">{`{{${opt.varName}}}`}</span>
            {opt.description && (
              <span className="block text-[10px] font-sans text-muted-foreground mt-0.5">
                {opt.description}
              </span>
            )}
          </button>
        ))}
      </div>,
      document.body
    );
  };

  return (
    <LexicalTypeaheadMenuPlugin<VariableMenuOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={menuRenderFn}
    />
  );
}

// ---------------------------------------------------------------------------
// ExternalStateSync — sync value prop → editor state on mount
// ---------------------------------------------------------------------------

interface ExternalStateSyncProps {
  value: LexicalState | null;
}

function ExternalStateSync({ value }: ExternalStateSyncProps): null {
  const [editor] = useLexicalComposerContext();
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    if (!value) return;

    try {
      const stateStr = JSON.stringify(value);
      const editorState = editor.parseEditorState(stateStr);
      // Defer past the current React flush — Lexical's setEditorState calls
      // flushSync internally, which throws when invoked from a lifecycle method.
      queueMicrotask(() => {
        try {
          editor.setEditorState(editorState);
        } catch {
          // empty or unrecognised root state — skip
        }
      });
    } catch {
      // malformed state — leave editor empty
    }
  }, [editor, value]);

  return null;
}

// ---------------------------------------------------------------------------
// Theme — DS Tailwind v4 tokens (no ai-tutor CSS vars)
// ---------------------------------------------------------------------------

const editorTheme = {
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "font-mono text-sm bg-secondary/40 px-1 rounded",
  },
  heading: {
    h1: "text-2xl font-bold mb-2",
    h2: "text-xl font-semibold mb-1.5",
    h3: "text-lg font-medium mb-1",
  },
  quote: "border-l-4 border-input pl-4 text-muted-foreground italic my-2",
  code: "block font-mono text-sm bg-secondary/40 p-3 rounded my-2 whitespace-pre-wrap",
  list: {
    ul: "list-disc list-inside my-1",
    ol: "list-decimal list-inside my-1",
    listitem: "my-0.5",
  },
  link: "text-primary underline cursor-pointer",
};

// ---------------------------------------------------------------------------
// RichTextEditor — main exported component
// ---------------------------------------------------------------------------

export function RichTextEditor({
  value,
  onChange,
  variables = [],
  placeholder,
  className,
  disabled = false,
}: RichTextEditorProps): JSX.Element {
  const initialConfig = {
    namespace: "RichTextEditor",
    theme: editorTheme,
    nodes: [
      HeadingNode,
      QuoteNode,
      CodeNode,
      ListNode,
      ListItemNode,
      LinkNode,
      VariableNode,
    ],
    onError: (error: Error) => {
      console.error("Lexical editor error:", error);
    },
    editable: !disabled,
  };

  const handleChange = useCallback(
    (editorState: EditorState) => {
      const json = editorState.toJSON() as unknown as LexicalState;
      onChange(json);
    },
    [onChange]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          "relative rounded-lg overflow-hidden bg-background border border-input",
          className
        )}
      >
        {!disabled && <ToolbarPlugin variables={variables} />}

        <div className="relative">
          <RichTextPlugin
            contentEditable={
              placeholder ? (
                <ContentEditable
                  className="min-h-[200px] px-4 py-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-placeholder={placeholder}
                  placeholder={() => (
                    <div className="absolute top-3 left-4 text-sm text-muted-foreground pointer-events-none">
                      {placeholder}
                    </div>
                  )}
                />
              ) : (
                <ContentEditable className="min-h-[200px] px-4 py-3 text-sm text-foreground outline-none" />
              )
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <VariablePlugin variables={variables} />
        <ExternalStateSync value={value} />
      </div>
    </LexicalComposer>
  );
}

export default RichTextEditor;
