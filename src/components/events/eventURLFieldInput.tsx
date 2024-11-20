"use client"
import {Input} from "@/components/ui/input";
import type {ControllerFieldState, ControllerRenderProps} from "react-hook-form";

import type {IEvent} from "@/types/event";
import React, {useState} from "react";
import Link from "next/link";

export interface EventURLFieldInputProps {
    field: ControllerRenderProps<IEvent, "Tag">
    fieldState: ControllerFieldState
    disabled?: boolean
    id?: string
}

export default function EventURLFieldInput({field, fieldState, disabled, id}: EventURLFieldInputProps) {
    const [showEventURL, setShowEventURL] = useState(!!field.value)
    return (
        !disabled ? <Input placeholder="Тег..." {...field}
                           id={id}
                           value={showEventURL && !fieldState.invalid ? `https://${field.value}.${process.env.NEXT_PUBLIC_DOMAIN}` : field.value}
                           onBlurCapture={() => {
                               if (field.value) {
                                   setShowEventURL(true)
                               }
                           }
                           }
                           onFocusCapture={() => {
                               setShowEventURL(false)
                           }}
                           disabled={disabled}
        /> : <Link
            id={id}
            href={`https://${field.value}.${process.env.NEXT_PUBLIC_DOMAIN}`}
            target="_blank"
            data-tooltip-content="Перейти до заходу"
            data-tooltip-id="tooltip"
            className={"flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors opacity-50 cursor-pointer"}
        >
            {`https://${field.value}.${process.env.NEXT_PUBLIC_DOMAIN}`}
        </Link>
    )
}