"use client"
import {BodyContent, BodyHeader} from "@/components/common/page";
import type React from "react";
import {useState} from "react";
import CategoriesTable from "@/components/exercises/CategoriesTable";
import {IExerciseCategory} from "@/types/exercise";
import ExercisesTable from "@/components/exercises/ExercisesTable";
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
                className={"gap-4 sm:grid sm:grid-cols-12 overflow-hidden grid-rows-1 short:flex short:flex-col short:w-full short:h-full"}>
                <div
                    className={"col-start-1 md:col-end-4 col-end-5 row-span-1 rounded-xl border short:w-full short:h-1/3"}
                >
                    <CategoriesTable setSelectedCategory={setSelectedCategory} selectedCategory={selectedCategory}/>
                </div>
                <div
                    className={"md:col-start-4 col-start-5 col-end-13 row-span-1 rounded-xl border short:w-full short:h-2/3"}
                >
                    <ExercisesTable selectedCategory={selectedCategory} search={search}/>
                </div>
            </BodyContent>
        </>
    )
}