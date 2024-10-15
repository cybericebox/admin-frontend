"use client"
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
import {IExercise} from "@/types/exercise";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";

export interface SelectChallengeFormProps {
    eventID: string
    categoryID: string
    onCancel?: () => void
}

export default function SelectChallengesForm({eventID, categoryID, onCancel}: SelectChallengeFormProps) {
    const [search, setSearch] = useState("")
    const {GetExerciseCategoriesResponse} = useExerciseCategory().useGetExerciseCategories()
    const {GetEventChallengesResponse} = useEventChallenge().useGetEventChallenges(eventID)
    const {GetExercisesResponse, GetExercisesRequest} = useExercise().useGetExercises({
        search,
        filter: (exercise: IExercise) => {
            return GetEventChallengesResponse?.Data.find(challenge => challenge.ExerciseID === exercise.ID) === undefined
        }
    })
    const [selectedExerciseIDs, setSelectedExerciseIDs] = useState<string[]>([])
    const {CreateEventChallenge} = useEventChallenge().useCreateEventChallenge(eventID)

    const onCreateChallenge = () => {
        CreateEventChallenge({
            CategoryID: categoryID,
            ExerciseIDs: selectedExerciseIDs,
        }, {
            onSuccess: () => {
                onCancel?.()
            },
            onError: (error) => {
                const e = error as IErrorResponse
                ErrorToast({message: "Не вдалося додати завдання", error: e})
            }
        })
        onCancel?.()
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
                            <TableHead>Задачі</TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        GetExercisesResponse?.Data &&
                        <TableBody className={styles.tableBody}>
                            {
                                GetExercisesResponse?.Data.map((exercise) => {
                                    const category = GetExerciseCategoriesResponse?.Data.find(category => category.ID === exercise.CategoryID)
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
                                            <TableCell>
                                                {exercise.Data.Tasks.map(task => {
                                                    return (
                                                        <div key={task.ID}
                                                             className={"text-white bg-primary border rounded-md px-2 py-1"}>
                                                            {task.Name}
                                                        </div>
                                                    )
                                                })}
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
                        GetExercisesRequest.isLoading ?
                            "Завантаження..." :
                            GetExercisesRequest.isError ?
                                "Помилка завантаження" :
                                GetExercisesRequest.isSuccess && GetExercisesResponse?.Data.length === 0 ?
                                    "Жодного завдання не знайдено" :
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