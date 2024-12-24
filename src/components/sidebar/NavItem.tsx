import React from 'react'
import Link from 'next/link'
import {cn} from "@/utils/cn";
import {usePathname} from "next/navigation";

export interface NavItemProps {
    Icon: React.ElementType
    title: string;
    to: string;
    customClickEvent?: () => void;
}


export default function NavItem({Icon, title, to, customClickEvent}: NavItemProps) {
    return (
        <div
            className={"flex flex-col w-full mt-4 short:mt-1"}
        >
            <Link
                href={to}
                data-tooltip-content={title}
                data-tooltip-id={"tooltip"}

                onClick={customClickEvent}
                className={cn("p-2 rounded-lg text-primary w-auto hover:bg-primary/90 hover:text-white", usePathname() === to && "bg-primary text-white")}

            >
                <div className={"flex flex-row items-center"}>
                    {<Icon/>}
                </div>

            </Link>
        </div>
    )
}