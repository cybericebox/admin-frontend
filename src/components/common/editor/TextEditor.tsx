"use client";

import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Toolbar from "./ToolBar";
import Underline from "@tiptap/extension-underline";
import CharacterCount from '@tiptap/extension-character-count'
import TextStyle from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Code from '@tiptap/extension-code'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import React from 'react'
import {Typography} from "@tiptap/extension-typography";
import {cn} from "@/utils/cn";

interface TextEditorProps {
    value: string
    onChange: (value: string) => void
    minCharacters?: number
    maxCharacters?: number
}

const defaultMinCharacters = 200
const defaultMaxCharacters = 10000

export const Extensions = [
    Paragraph,
    Text,
    Code,
    Typography,
    Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
        linkOnPaste: true,
        protocols: ["http", "ftp", "mailto"]
    }),
    Underline,
    // Color.configure({types: [TextStyle.name, ListItem.name]}),
    TextStyle.configure(),
    TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'left',
    }),
    StarterKit.configure({
        bulletList: {
            keepMarks: true,
            keepAttributes: false,
        },
        orderedList: {
            keepMarks: true,
            keepAttributes: false,
        },
    }),]

const TextEditor = ({onChange, value, minCharacters, maxCharacters}: TextEditorProps) => {
    minCharacters = minCharacters || defaultMinCharacters
    maxCharacters = maxCharacters || defaultMaxCharacters
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [...Extensions, CharacterCount.configure({
            limit: maxCharacters,
        })],
        editorProps: {
            attributes: {
                class:
                    "flex flex-col px-3 py-3 border-input border-b border-r border-l text-primary w-full gap-3 font-medium text-[16px] pt-4 rounded-bl-md rounded-br-md",
            },
        },
        onUpdate: ({editor}) => {
            // trim content with <!-- Valid --> comments in only in start
            const content = editor.getHTML().replace(/<!--\s*Valid\s*-->/, "");

            if (editor.storage.characterCount.characters() < minCharacters) {
                onChange(content)
            } else {
                onChange(`<!-- Valid -->${content}`)
            }

        },
        content: value,
    });

    if (!editor) {
        return null;
    }

    return (
        <div className="w-full relative">
            <Toolbar editor={editor} content={value}/>
            <EditorContent editor={editor} className={"overflow-auto max-h-96 max-w-full"}/>
            <div
                className={cn(`absolute bottom-1 right-1 character-count px-2 py-0.5 rounded-md text-white bg-primary`, (editor.storage.characterCount.characters() < minCharacters) && "bg-destructive")}>
                {(editor.storage.characterCount.characters() < minCharacters) && `${minCharacters} / `}{editor.storage.characterCount.characters()} / {maxCharacters} символів
            </div>
        </div>
    );
};

export default TextEditor;