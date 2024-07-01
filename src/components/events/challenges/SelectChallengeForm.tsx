"use client"
import "react-datepicker/dist/react-datepicker.css";
import {useExercise} from "@/hooks/useExercise";
import React, {useState} from "react";
import {Search} from "@/components/common";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import styles from "@/components/components.module.css";
import {Checkbox} from "@/components/ui/checkbox";
import {Button} from "@/components/ui/button";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";

export interface SelectChallengeFormProps {
    eventID: string
    categoryID: string
    onCancel?: () => void
}

export default function SelectChallengesForm({eventID, categoryID, onCancel}: SelectChallengeFormProps) {
    const getExercises = useExercise().useGetExercises()
    const [selectedExerciseIDs, setSelectedExerciseIDs] = useState<string[]>([])
    const [search, setSearch] = useState("")
    const createChallenge = useEventChallenge().useCreateEventChallenge(eventID)
    const getExerciseCategories = useExerciseCategory().useGetExerciseCategories()

    const onCreateChallenge = () => {
        createChallenge.mutate({
            CategoryID: categoryID,
            ExerciseIDs: selectedExerciseIDs

        })
        onCancel && onCancel()
    }

    return (
        <div>
            <BodyHeader title={"Завдання"}>
                <Search setSearch={setSearch} placeholder={"Знайти завдання"} key={"search"}/>
            </BodyHeader>
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow>
                            <TableHead>Обрати</TableHead>
                            <TableHead>Назва завдання</TableHead>
                            <TableHead>Категорія</TableHead>
                            <TableHead>Тип</TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        getExercises.data &&
                        <TableBody className={styles.tableBody}>
                            {
                                getExercises.data?.map((exercise) => {
                                    const category = getExerciseCategories.data?.find(category => category.ID === exercise.CategoryID)
                                    return (
                                        <TableRow key={exercise.ID}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedExerciseIDs.includes(exercise.ID!)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedExerciseIDs([...selectedExerciseIDs, exercise.ID!])
                                                        } else {
                                                            setSelectedExerciseIDs(selectedExerciseIDs.filter(id => id !== exercise.ID))
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {exercise.Name}
                                            </TableCell>
                                            <TableCell>
                                                {category?.Name || ""}
                                            </TableCell>
                                            <TableCell>
                                                {exercise.Data.Instances.length === 0 ? "Статичний" : "Динамічний"}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            }
                        </TableBody>
                    }
                </Table>
                <div
                    className={styles.emptyTableBody}
                >
                    {
                        getExercises.isLoading ?
                            "Завантаження..." :
                            getExercises.isError ?
                                "Помилка завантаження" :
                                getExercises.isSuccess && getExercises.data.length === 0 ?
                                    "Жодного завдання не створено" :
                                    null
                    }
                </div>
                <Button
                    onClick={() => {
                        onCreateChallenge()
                    }}
                    className={"w-full mt-4"}
                >
                    Додати завдання
                </Button>
            </BodyContent>

        </div>

    )
}