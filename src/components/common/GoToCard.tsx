import type React from "react";
import {IconType} from "react-icons";
import Link from "next/link";

interface GoToCardProps {
    descIcon: IconType
    linkIcon: IconType
    title: string
    description: string
    to: string
}

export default function GoToCard({descIcon, linkIcon, to, title, description}: GoToCardProps) {
    return (
        <div
            className="bg-white rounded-xl p-0 h-full lg:max-w-[500px] lg:min-w-[400px] md:min-w-[400px] md:max-w-[400px] sm:min-w-[350px] min-w-full shadow-md hover:shadow-lg transition duration-300 ease-in-out"
        >
            <div
                className="grid grid-cols-5 h-full w-full"
            >
                <div
                    className="col-start-1 col-span-4 text-primary p-2"
                >
                    <div
                        className="flex frex-row items-center justify-start space-x-1 lg:space-x-3 w-full"
                    >
                        <div>
                            {descIcon({className: "size-9"})}
                        </div>
                        <div className="flex flex-col ml-5">
                            <div
                                className="font-bold"
                            >
                                {title}
                            </div>
                            <div
                                className={"hidden md:block"}
                            >
                                {description}
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    className="col-start-5 col-span-1 bg-primary text-white text-3xl rounded-r-xl"
                >
                    <Link
                        className="flex items-center justify-center h-full w-full"
                        href={to}
                    >
                        {linkIcon({})}
                    </Link>
                </div>
            </div>
        </div>
    );
}
