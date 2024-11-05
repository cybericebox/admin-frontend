"use client";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {Search} from "@/components/common";
import {UserSearch} from "lucide-react";
import React, {useState} from "react";
import UsersTable from "./UsersTable";

export default function Users() {
    const [search, setSearch] = useState("")
    return (
        <>
            <BodyHeader title={"Користувачі"}>
                <Search setSearch={setSearch} placeholder={"Знайти користувача"} key={"search"}
                        SearchIcon={UserSearch}/>
            </BodyHeader>
            <BodyContent>
                <UsersTable search={search}/>
            </BodyContent>
        </>
    )
}