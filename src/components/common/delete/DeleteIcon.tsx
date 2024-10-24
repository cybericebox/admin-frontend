import styles from "@/components/components.module.css";
import React from "react";
import {cn} from "@/utils/cn";
import {Trash2, X} from "lucide-react";


interface DeleteIconProps {
    title?: string
    onClick: () => void
    className?: string
    cross?: boolean
}

export default function DeleteIcon(props: DeleteIconProps) {
    const Icon = props.cross ? X : Trash2
    const showTooltip = props.title && props.title.length > 0
    return (
        <Icon className={cn(styles.deleteIcon, props.className)}
                onClick={props.onClick}
                aria-label={props.title}
                data-tooltip-content={showTooltip && props.title}
                data-tooltip-id={showTooltip && "tooltip"}
        />
    )
}