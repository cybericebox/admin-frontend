import styles from "@/components/components.module.css";
import {MdDelete} from "react-icons/md";
import React from "react";

interface DeleteIconProps {
    title: string
    onClick: () => void
}

export default function DeleteIcon(props: DeleteIconProps) {
    return (
        <MdDelete className={styles.deleteIcon}
                  onClick={props.onClick}
                  aria-label={props.title}
                  data-tooltip-content={props.title}
                  data-tooltip-effect="solid"
                  data-tooltip-id="tooltip"
        />
    )
}