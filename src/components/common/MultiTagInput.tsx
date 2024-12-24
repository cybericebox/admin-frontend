"use client";
import React, {useState} from "react";
import {X} from "lucide-react";
import {cn} from "@/utils/cn";

interface MultiTagInputProps {
    tags: string[]
    setTags: (value: string[]) => void
    placeholder?: string
    className?: string
    errorTagsIndexes?: number[]
}

export default function MultiTagInput({
                                          placeholder = "",
                                          tags,
                                          className,
                                          errorTagsIndexes, ...props
                                      }: MultiTagInputProps) {
    const [tag, setTag] = useState<string>("")
    const onChange = (e: string) => {
        if (e.length) {
            const ts = e.split(" ")
            if (ts.length > 1) {
                props.setTags(Array.from(new Set([...tags, ...ts.filter(t => t.length)])))
                setTag("")
            } else {
                setTag(e)
            }
        } else {
            setTag(e)
        }
    }

    const onDelete = (tag: string) => {
        props.setTags(tags.filter(t => t !== tag))
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && tag.length) {
            props.setTags(Array.from(new Set([...tags, tag])))
            setTag("")
        }
        if (e.key === "Backspace" && !tag.length && tags.length) {
            props.setTags(tags.slice(0, tags.length - 1))
        }
    }

    return (
        <div
            className={cn("flex flex-wrap gap-1 rounded-md border border-input p-2 overflow-auto w-full bg-transparent px-3 py-1 text-sm shadow-sm transition-colors ", className)}
            onKeyDown={onKeyDown}
        >{
            tags.map((tag, index) => (
                <Tag key={index} tag={tag} onDelete={() => onDelete(tag)} hasError={errorTagsIndexes?.includes(index)}/>
            ))
        }
            <input
                type={"text"}
                className={"bg-transparent border-none focus:outline-none flex-1"}
                value={tag}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
            />
        </div>
    )
}

function Tag({tag, onDelete, hasError}: { tag: string, onDelete: () => void, hasError?: boolean }) {
    return (
        <div
            className={cn("w-fit flex items-center justify-center px-2 gap-0.5 bg-gray-200 rounded-2xl", hasError && "bg-destructive text-destructive-foreground")}
        >
            {tag}
            <X
                size={15}
                aria-label={"Delete tag"}
                data-tooltip-content={"Видалити"}

                data-tooltip-id="tooltip"
                onClick={onDelete}
            />
        </div>
    )
}