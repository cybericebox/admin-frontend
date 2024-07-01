'use client';

import type React from "react";
import QueryProvider from "@/utils/providers/queryProvider";
import styles from "@/components/sidebar/sidebar.module.css";
import {Tooltip} from "react-tooltip";


export default function Providers({children}: {
    children: React.ReactNode;
}) {
    return (
        <QueryProvider>
            {children}
            <Tooltip
                id={"tooltip"}
                className={styles.sidebarItemTooltip}
            />
        </QueryProvider>
    )
}