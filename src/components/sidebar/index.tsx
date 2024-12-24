'use client';
import React from "react";
import NavItem from "@/components/sidebar/NavItem";
import Logo from "@/components/Logo";
import {signOut} from "@/api/authAPI";
import {Calendar, Flag, LogOut, UserRoundCog, UsersRound} from "lucide-react";

export default function SideBar() {
    return (
        <div
            className={"flex flex-col justify-between items-center sticky m-1 sm:m-3 shadow-md bg-white overflow-x-hidden overflow-y-auto w-[75px] rounded-xl"}
        >
            <div
                className={"flex flex-col items-center justify-center p-1 my-4 short:p-1 short:my-1"}
            >
                <Logo/>
                <div>
                    <NavItem Icon={Calendar} title="Заходи" to="/events"/>
                    <NavItem Icon={UsersRound} title="Користувачі" to="/users"/>
                    <NavItem Icon={Flag} title="Завдання" to="/exercises"/>
                </div>
            </div>

            <div
                className={"flex flex-col items-center p-1 my-4 short:p-1 short:my-1"}
            >
                <NavItem Icon={UserRoundCog} title="Профіль"
                         to={`https://${process.env.NEXT_PUBLIC_DOMAIN}/profile`}/>
                <NavItem Icon={LogOut} title="Вийти" customClickEvent={signOut}
                         to={`https://${process.env.NEXT_PUBLIC_DOMAIN}/`}/>
            </div>
        </div>
    );
}