"use client";

import React from "react";
import {type Editor} from "@tiptap/react";
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Code,
    Eraser,
    Heading,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    Link,
    List,
    ListOrdered,
    Quote,
    Redo,
    Strikethrough,
    Underline,
    Undo
} from "lucide-react";

import {Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger,} from "@/components/ui/menubar"

type Props = {
    editor: Editor | null;
    content: string;
};


const Toolbar = ({editor}: Props) => {
    if (!editor) {
        return null;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href
        if (typeof window === 'undefined') {
            return
        }
        const url = window.prompt('URL', previousUrl)

        // cancelled
        if (url === null) {
            return
        }
        // empty
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()

            return
        }

        // update link
        editor.chain().focus().extendMarkRange('link').setLink({href: url})
            .run()
    }

    let AlignBaselineIcon = editor.isActive({textAlign: 'left'}) ? AlignLeft : editor.isActive({textAlign: 'center'}) ? AlignCenter : editor.isActive({textAlign: 'right'}) ? AlignRight : AlignJustify

    return (
        <div
            className="px-2 py-2 rounded-tl-md rounded-tr-md flex justify-between items-start
    gap-5 w-full flex-wrap border"
        >
            <div className="flex justify-start items-center gap-3 w-full flex-wrap">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleBold().run();
                    }}
                    className={
                        editor.isActive("bold")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Bold className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleItalic().run();
                    }}
                    className={
                        editor.isActive("italic")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Italic className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleUnderline().run();
                    }}
                    className={
                        editor.isActive("underline")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Underline className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleStrike().run();
                    }}
                    className={
                        editor.isActive("strike")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Strikethrough className="w-5 h-5"/>
                </button>
                <Menubar className={"max-w-10"}>
                    <MenubarMenu>
                        <MenubarTrigger> <Heading className="w-5 h-5"/></MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        editor.chain().focus().toggleHeading({level: 1}).run();
                                    }}
                                    className={
                                        editor.isActive("heading", {level: 1})
                                            ? "bg-primary text-white p-1 rounded-lg"
                                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                                    }
                                >
                                    <Heading1 className="w-5 h-5"/>
                                </button>
                            </MenubarItem>
                            <MenubarItem>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        editor.chain().focus().toggleHeading({level: 2}).run();
                                    }}
                                    className={
                                        editor.isActive("heading", {level: 2})
                                            ? "bg-primary text-white p-1 rounded-lg"
                                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                                    }
                                >
                                    <Heading2 className="w-5 h-5"/>
                                </button>
                            </MenubarItem>
                            <MenubarItem>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        editor.chain().focus().toggleHeading({level: 3}).run();
                                    }}
                                    className={
                                        editor.isActive("heading", {level: 3})
                                            ? "bg-primary text-white p-1 rounded-lg"
                                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                                    }
                                >
                                    <Heading3 className="w-5 h-5"/>
                                </button>
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
                <Menubar className={"max-w-10"}>
                    <MenubarMenu>
                        <MenubarTrigger> <AlignBaselineIcon className="w-5 h-5"/></MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        editor.chain().focus().setTextAlign("left").run();
                                    }}
                                    className={
                                        editor.isActive({textAlign: 'left'})
                                            ? "bg-primary text-white p-1 rounded-lg"
                                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                                    }
                                >
                                    <AlignLeft className="w-5 h-5"/>
                                </button>
                            </MenubarItem>
                            <MenubarItem>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        editor.chain().focus().setTextAlign("center").run();
                                    }}
                                    className={
                                        editor.isActive({textAlign: 'center'})
                                            ? "bg-primary text-white p-1 rounded-lg"
                                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                                    }
                                >
                                    <AlignCenter className="w-5 h-5"/>
                                </button>
                            </MenubarItem>
                            <MenubarItem>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        editor.chain().focus().setTextAlign("right").run();
                                    }}
                                    className={
                                        editor.isActive({textAlign: 'right'})
                                            ? "bg-primary text-white p-1 rounded-lg"
                                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                                    }
                                >
                                    <AlignRight className="w-5 h-5"/>
                                </button>
                            </MenubarItem>
                            <MenubarItem>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        editor.chain().focus().setTextAlign("justify").run();
                                    }}
                                    className={
                                        editor.isActive({textAlign: 'justify'})
                                            ? "bg-primary text-white p-1 rounded-lg"
                                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                                    }
                                >
                                    <AlignJustify className="w-5 h-5"/>
                                </button>
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>


                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleBulletList().run();
                    }}
                    className={
                        editor.isActive("bulletList")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <List className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleOrderedList().run();
                    }}
                    className={
                        editor.isActive("orderedList")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <ListOrdered className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        if (!editor.isActive("link")) {
                            setLink()
                        } else {
                            editor.chain().focus().unsetLink().run();
                        }

                    }}
                    className={
                        editor.isActive("link")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Link className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleBlockquote().run();
                    }}
                    className={
                        editor.isActive("blockquote")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Quote className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().setCodeBlock().run();
                    }}
                    className={
                        editor.isActive("codeBlock")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Code className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().undo().run();
                    }}
                    className={
                        editor.isActive("undo")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Undo className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().redo().run();
                    }}
                    className={
                        editor.isActive("redo")
                            ? "bg-primary text-white p-1 rounded-lg"
                            : "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Redo className="w-5 h-5"/>
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        editor.chain().focus().clearNodes().run();
                    }}
                    className={
                        "text-primary hover:bg-primary/70 hover:text-white p-1 hover:rounded-lg"
                    }
                >
                    <Eraser className="w-5 h-5"/>
                </button>
            </div>
        </div>
    );
};

export default Toolbar;