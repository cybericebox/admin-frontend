import styles from "@/components/components.module.css";
import React from "react";
import {Plus} from "lucide-react";

interface AddIconProps {
    title: string
    onClick: () => void
}

export default function AddIcon(props: AddIconProps) {
    return (
        <Plus
            className={styles.addIcon}
            onClick={props.onClick}
            aria-label={props.title}
            data-tooltip-content={props.title}
            data-tooltip-id="tooltip"
        />
    )
}