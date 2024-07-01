"use client"
import {Input} from "@/components/ui/input";
import type {ControllerFieldState, ControllerRenderProps} from "react-hook-form";

import type {Event} from "@/types/event";
import {useState} from "react";

export interface EventURLFieldInputProps {
    field: ControllerRenderProps<Event, "Tag">
    fieldState: ControllerFieldState
    disabled?: boolean
    domain: string
}

export default function EventURLFieldInput({field, fieldState, disabled, domain}: EventURLFieldInputProps) {
    const [showEventURL, setShowEventURL] = useState(!!field.value)
    return (
        <Input placeholder="Тег..." {...field}
               value={showEventURL && !fieldState.invalid ? `https://${field.value}.${domain}` : field.value}
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