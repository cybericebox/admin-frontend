import type React from "react";
import {cn} from "@/utils/cn";

interface FormButtonsProps {
    children?: React.ReactNode
    show: boolean
}

export default function FormButtons({children, show}: FormButtonsProps) {
    return (
        <div
            className={cn("w-full h-fit", show ? "visible" : "invisible")}
        >
            <div
                className={"flex flex-row justify-evenly items-center"}
            >
                {children}
            </div>

        </div>
    )
}