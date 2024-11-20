"use client"
import {BodyContent, BodyHeader} from "@/components/common/page";
import type React from "react";
import {useState} from "react";
import CategoriesTable from "./CategoriesTable";
import {type IExerciseCategory} from "@/types/exercise";
import ExercisesTable from "./ExercisesTable";
import {Search} from "@/components/common";

export default function Exercises() {
    const [selectedCategory, setSelectedCategory] = useState<IExerciseCategory>()
    const [search, setSearch] = useState<string>("")

    return (
        <>
            <BodyHeader title={"Завдання"}>
                <Search setSearch={setSearch} placeholder={"Знайти завдання"} key={"search"}/>
            </BodyHeader>
            <BodyContent
                className={"gap-4 sm:grid sm:grid-cols-12 overflow-hidden grid-rows-1 flex flex-col w-full h-full"}>
                <div
                    className={"sm:col-start-1 md:col-end-4 sm:col-end-5 sm:row-span-1 rounded-xl border w-full h-1/3 sm:h-full"}
                >
                    <CategoriesTable setSelectedCategory={setSelectedCategory} selectedCategory={selectedCategory}/>
                </div>
                <div
                    className={"md:col-start-4 sm:col-start-5 sm:col-end-13 sm:row-span-1 rounded-xl border w-full h-2/3 sm:h-full"}
                >
                    <ExercisesTable selectedCategory={selectedCategory} search={search}/>
                </div>
            </BodyContent>
        </>
    )
}