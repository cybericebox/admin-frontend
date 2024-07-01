import type React from "react";

interface PageProps {
    children?: React.ReactNode;
}

export default function Page({children}: PageProps) {
    return (
        <div className="h-full w-full flex flex-col short:gap-2 gap-2 sm:gap-4">
            {children}
        </div>
    )
}