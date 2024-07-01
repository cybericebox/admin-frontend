'use client';
import React, {useState} from "react";
import styles from "./sidebar.module.css";
import cn from "classnames";
import {FiCalendar, FiLogOut, FiMenu, FiUsers} from "react-icons/fi";
import NavItem from "@/components/sidebar/NavItem";
import {MdOutlinedFlag} from "react-icons/md";
import {RiUserSettingsLine} from "react-icons/ri";
import Logo from "@/components/Logo";
import {signOut} from "@/api/authAPI";

export default function SideBar({domain}: { domain: string }) {

    const [navSize, changeNavSize] = useState<"small" | "large">("small");
    return (
        <div
            className={cn(styles.sidebar, navSize === "small" ? "w-[75px] rounded-xl" : "w-[220px] rounded-2xl")}
        >
            <div
                className={cn(styles.sidebarSection, navSize === "small" ? "items-center" : "items-start")}
            >
                <Logo/>
                <div
                    className={styles.sidebarMenuButton}
                    onClick={() => {
                        if (navSize === "small")
                            changeNavSize("large")
                        else
                            changeNavSize("small")
                    }}
                >
                    <FiMenu/>
                </div>
                <NavItem navSize={navSize} icon={FiCalendar} title="Заходи" to="/events"/>
                <NavItem navSize={navSize} icon={FiUsers} title="Користувачі" to="/users"/>
                <NavItem navSize={navSize} icon={MdOutlinedFlag} title="Завдання" to="/exercises"/>
            </div>

            <div
                className={cn(styles.sidebarSection, navSize === "small" ? "items-center" : "items-start")}
            >
                <NavItem navSize={navSize} icon={RiUserSettingsLine} title="Профіль"
                         to={`https://${domain}/profile`}/>
                <NavItem navSize={navSize} icon={FiLogOut} title="Вийти" customClickEvent={signOut}
                         to={`https://${domain}/`}/>
            </div>
        </div>
    );
}