import type React from "react";

interface FormButtonsProps {
    children?: React.ReactNode
}

export default function FormButtons({children}: FormButtonsProps) {
    return (
        <div
            className={"w-full row-start-12 row-span-2"}
        >
            <div
                className={"h-full w-full flex flex-row justify-evenly items-center"}
            >
                {children}
            </div>

        </div>
    )
}