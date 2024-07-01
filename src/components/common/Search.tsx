import {debounce} from "lodash";
import type React from "react";
import {MdOutlinePersonSearch} from "react-icons/md";
import cn from "classnames";

export interface SearchProps {
    setSearch: (search: string) => void;
    placeholder?: string;
    className?: string;
    debounceWait?: number;
}

export default function Search({setSearch, placeholder, className, debounceWait}: SearchProps) {
    return (
        <div
            className={cn("flex items-center px-3 py-1 rounded-lg border border-primary", className)}
        >
            <MdOutlinePersonSearch/>
            <input
                className={"w-full ml-2 focus:outline-none focus:border-transparent"}
                type={"search"}
                placeholder={placeholder || ""}
                onChange={debounce(
                    (e) => {
                        setSearch(e.target.value);
                    },
                    debounceWait || 500,
                )
                }
            />
        </div>

    );
}