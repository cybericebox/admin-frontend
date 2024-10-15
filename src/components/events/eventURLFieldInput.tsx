"use client"
import {Input} from "@/components/ui/input";
import type {ControllerFieldState, ControllerRenderProps} from "react-hook-form";

import type {IEvent} from "@/types/event";
import {useState} from "react";

export interface EventURLFieldInputProps {
    field: ControllerRenderProps<IEvent, "Tag">
    fieldState: ControllerFieldState
    disabled?: boolean
}

export default function EventURLFieldInput({field, fieldState, disabled}: EventURLFieldInputProps) {
    const [showEventURL, setShowEventURL] = useState(!!field.value)
    return (
        <Input placeholder="Тег..." {...field}
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

        />
    )
}