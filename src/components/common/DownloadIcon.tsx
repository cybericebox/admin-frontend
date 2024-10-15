import styles from "@/components/components.module.css";
import React from "react";
import {cn} from "@/utils/cn";
import {Download} from "lucide-react";

interface DownloadIconProps {
    title: string
    onClick: () => void
    className?: string
}

export default function DownloadIcon(props: DownloadIconProps) {
    return (
        <Download
            className={cn(styles.downloadIcon, props.className)}
            onClick={props.onClick}
            aria-label={props.title}
            data-tooltip-content={props.title}

            data-tooltip-id="tooltip"
        />
    )
}