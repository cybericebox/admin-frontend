import styles from "@/components/components.module.css";
import React from "react";
import {cn} from "@/utils/cn";
import {Undo} from "lucide-react";


interface UndoIconProps {
    title: string
    onClick?: () => void
    className?: string
}

export default function UndoIcon(props: UndoIconProps) {
    return (
        <Undo className={cn(styles.editIcon, props.className)}
                onClick={props?.onClick}
                aria-label={props.title}
                data-tooltip-content={props.title}
                data-tooltip-id="tooltip"
        />
    )
}