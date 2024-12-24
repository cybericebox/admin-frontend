import {debounce} from "lodash";
import type React from "react";
import {cn} from "@/utils/cn";
import {Search} from "lucide-react";

export interface SearchProps {
    setSearch: (search: string) => void;
    placeholder?: string;
    className?: string;
    debounceWait?: number;
    SearchIcon?: React.ElementType;
}

export default function SearchInput({setSearch, placeholder, className, debounceWait, SearchIcon}: SearchProps) {
    if (!SearchIcon) {
        SearchIcon = Search
    }
    return (
        <div
            className={cn("flex items-center px-3 py-1 rounded-lg border border-primary", className)}
        >
            <SearchIcon className={"size-6 text-primary"}/>
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