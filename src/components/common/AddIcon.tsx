import styles from "@/components/components.module.css";
import React from "react";
import {FaPlus} from "react-icons/fa";

interface AddIconProps {
    title: string
    onClick: () => void
}

export default function AddIcon(props: AddIconProps) {
    return (
        <FaPlus className={styles.addIcon}
                onClick={props.onClick}
                aria-label={props.title}
                data-tooltip-content={props.title}
                data-tooltip-effect="solid"
                data-tooltip-id="tooltip"
        />
    )
}