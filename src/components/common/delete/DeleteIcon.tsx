import styles from "@/components/components.module.css";
import React from "react";
import {cn} from "@/utils/cn";
import {Trash2} from "lucide-react";


interface DeleteIconProps {
    title: string
    onClick: () => void
    className?: string
}

export default function DeleteIcon(props: DeleteIconProps) {
    return (
        <Trash2 className={cn(styles.deleteIcon, props.className)}
                onClick={props.onClick}
                aria-label={props.title}
                data-tooltip-content={props.title}
                data-tooltip-id="tooltip"
        />
    )
}