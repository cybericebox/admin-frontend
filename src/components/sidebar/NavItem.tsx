import type React from 'react'
import Link from 'next/link'
import {IconType} from "react-icons";
import cn from "classnames";
import styles from './sidebar.module.css'
import {usePathname} from "next/navigation";
import "./sidebar.module.css"

export interface NavItemProps {
    icon: IconType;
    title: string;
    navSize: "small" | "large";
    to: string;
    customClickEvent?: () => void;
}


export default function NavItem({icon, title, navSize, to, customClickEvent}: NavItemProps) {
    return (
        <div
            className={cn(styles.sidebarItem, navSize === "small" ? "items-center" : "items-start")}
        >
            <Link
                href={to}
                data-tooltip-content={title}
                data-tooltip-id={"tooltip"}
                data-tooltip-hidden={navSize === "large"}
                data-tooltip-effect="solid"
                onClick={customClickEvent}
                className={cn(styles.sidebarItemLink, navSize === "large" ? "w-full" : "w-auto", usePathname() === to && styles.sidebarItemLinkActive)}

            >

                <div className={styles.sidebarItemData}>
                    {icon({className: styles.sidebarItemIcon})}
                    <div
                        className={cn(styles.sidebarItemText, navSize === "small" ? "hidden" : "flex")}
                    >
                        {title}
                    </div>

                </div>

            </Link>
        </div>
    )
}