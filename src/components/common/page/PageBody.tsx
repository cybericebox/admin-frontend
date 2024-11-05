import type React from "react";
import {cn} from "@/utils/cn";

interface PageBodyProps {
    children?: React.ReactNode
}

export function PageBody({children}: PageBodyProps) {
    return (
        <div
            className="w-full h-full overflow-hidden flex-1 flex flex-col short:space-y-1 space-y-3 rounded-2xl shadow-md short:pt-1 short:pb-2 pt-2 px-4 pb-5 bg-white text-primary">
            {children}
        </div>
    )
}

interface BodyHeaderProps {
    children?: React.ReactNode
    title: string
    textSize?: string
}

export function BodyHeader({title, children, textSize = "text-2xl"}: BodyHeaderProps) {
    return (
        <div className={"w-full h-fit"}>
            <div
                className="flex flex-wrap short:gap-2 gap-2 sm:gap-4 items-center justify-left sm:justify-between w-full sm:px-2.5 px-0"
            >
                <div
                    className={cn("font-bold leading-10 sm:ml-0 ml-2", textSize)}
                >
                    {title}
                </div>
                {children}
            </div>
        </div>
    )
}

interface BodyContentProps {
    children?: React.ReactNode
    className?: string
}

export function BodyContent({children, className}: BodyContentProps) {
    return (
        <div
            className={cn("flex-1 w-full h-full rounded-lg shadow-sm overflow-hidden", className)}
        >
            {children}
        </div>
    )
}