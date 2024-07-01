import React, {DetailedHTMLProps, FormHTMLAttributes} from "react";

interface FormBodyProps extends DetailedHTMLProps<FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> {
    children: React.ReactNode
}

export default function FormProvider({children, onSubmit}: FormBodyProps) {
    return (
        <form
            onSubmit={onSubmit}
            className={"h-full w-full overflow-hidden py-2"}
        >
            <div
                className={"h-full w-full grid grid-flow-row grid-rows-12 gap-4"}
            >
                {children}
            </div>

        </form>
    )
}