"use client"
import {BodyContent, BodyHeader} from "@/components/common/page";
import type React from "react";
import {useState} from "react";
import CategoriesTable from "@/components/exercises/CategoriesTable";
import {ExerciseCategory} from "@/types/exercise";
import ExercisesTable from "@/components/exercises/ExercisesTable";

export default function ExercisesCard() {
    const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>()

    return (
        <>
            <BodyHeader title={"Завдання"}>
            </BodyHeader>
            <BodyContent>
                <div
                    className={"h-full w-full flex flex-col gap-4 sm:grid sm:grid-cols-12"}
                >
                    <div
                        className={"h-full w-full col-start-1 md:col-end-4 col-end-5 rounded-xl border"}
                    >
                        <CategoriesTable setSelectedCategory={setSelectedCategory}/>
                    </div>
                    <div
                        className={"h-full w-full md:col-start-4 col-start-5 col-end-13 rounded-xl border"}
                    >
                        <ExercisesTable selectedCategory={selectedCategory}/>
                    </div>
                </div>
            </BodyContent>
        </>
    )
}