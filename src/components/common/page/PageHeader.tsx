import type React from "react";
import {Children} from "react";


interface PageHeaderProps {
    children?: React.ReactNode;
}

export default function PageHeader({children}: PageHeaderProps) {
    const childrenCount = Children.count(children)
    if (childrenCount === 1) {
        return (
            <div className="max-h-fit w-full">
                <div
                    className="flex flex-row-reverse items-center justify-center lg:justify-normal lg:ml-[-22%] w-full"
                >
                    {children}
                </div>
            </div>
        )
    }

    return (
        <div className="max-h-fit w-full">
            <div
                className="flex flex-wrap gap-2 sm:gap-4 items-center justify-center md:justify-evenly w-full"
            >
                {children}
            </div>
        </div>
    )
}