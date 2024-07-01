import type React from "react";

interface FormFieldsProps {
    children?: React.ReactNode
}

export default function FormFields({children}: FormFieldsProps) {
    return (
        <div
            className={"w-full h-full row-start-1 row-end-12 overflow-y-auto overflow-x-hidden"}
        >
            <div
                className={"w-full h-96 flex flex-col gap-4 px-0.5"}
            >
                {children}
            </div>

        </div>
    )
}