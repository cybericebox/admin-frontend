import styles from "@/components/components.module.css";
import React from "react";
import {cn} from "@/utils/cn";
import {Pencil} from "lucide-react";


interface EditIconProps {
    title: string
    onClick?: () => void
    className?: string
}

export default function EditIcon(props: EditIconProps) {
    return (
        <Pencil className={cn(styles.editIcon, props.className)}
                onClick={props?.onClick}
                aria-label={props.title}
                data-tooltip-content={props.title}
                data-tooltip-id="tooltip"
        />
    )
}