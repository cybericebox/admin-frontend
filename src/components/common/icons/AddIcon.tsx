import React from "react";
import {Plus} from "lucide-react";
import {cn} from "@/utils/cn";

interface AddIconProps {
    title: string
    onClick: () => void
    className?: string
}

export default function AddIcon(props: AddIconProps) {
    return (
        <Plus
            className={cn("w-5 h-5 border border-green-500 rounded text-green-500 font-bold text-4xl cursor-pointer", props.className)}
            onClick={props.onClick}
            aria-label={props.title}
            data-tooltip-content={props.title}
            data-tooltip-id="tooltip"
        />
    )
}