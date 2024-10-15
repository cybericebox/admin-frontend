"use client"

import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import React, {useState} from "react";
import {IExercise, IExerciseCategory} from "@/types/exercise";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import {useExercise} from "@/hooks/useExercise";
import Link from "next/link";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import toast from "react-hot-toast";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";

interface ExercisesTableProps {
    selectedCategory?: IExerciseCategory
    search: string
}

export default function ExercisesTable({selectedCategory, search}: ExercisesTableProps) {
    const {GetExercisesResponse, GetExercisesRequest} = useExercise().useGetExercises({
        search,
        categoryID: selectedCategory?.ID
    })
    const {DeleteExercise} = useExercise().useDeleteExercise()
    const {GetExerciseCategoriesResponse} = useExerciseCategory().useGetExerciseCategories()
    const [deleteExerciseDialog, setDeleteExerciseDialog] = useState<IExercise>()

    return (
        <>
            <Table>
                <TableHeader className={styles.tableHeader}>
                    <TableRow>
                        <TableHead>Назва завдання</TableHead>
                        <TableHead>Категорія</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Задачі</TableHead>
                    </TableRow>
                </TableHeader>
                {
                    GetExercisesResponse?.Data &&
                    <TableBody>
                        {
                            GetExercisesResponse?.Data.map((exercise) => {
                                const category = GetExerciseCategoriesResponse?.Data.find(category => category.ID === exercise.CategoryID)
                                return (
                                    <TableRow key={exercise.ID}>
                                        <TableCell>
                                            <Link
                                                href={"/exercises/" + exercise.ID}
                                                color="#54616e"
                                                aria-label={"Exercise settings"}
                                                data-tooltip-content="Перейти до налаштувань завдання"

                                                data-tooltip-id="tooltip"
                                            >
                                                {exercise.Name}
                                            </Link>
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
                                                         className={"w-fit text-white bg-primary border rounded-md px-2 py-1"}>
                                                        {task.Name}
                                                    </div>
                                                )
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <DeleteIcon
                                                onClick={() => setDeleteExerciseDialog(exercise)}
                                                title={"Видалити завдання"}
                                            />
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
                                "Жодного завдання не створено" :
                                null
                }
            </div>
            {!!deleteExerciseDialog &&
                <DeleteDialog
                    isOpen={!deleteExerciseDialog}
                    onClose={() => setDeleteExerciseDialog(undefined)}
                    name={deleteExerciseDialog.Name}
                    description={"Впевнені? Всі дані будуть втрачені та не можуть бути відновлені."}
                    onDelete={() => DeleteExercise(deleteExerciseDialog.ID!, {
                        onSuccess: () => {
                            toast.success("Завдання успішно видалено")
                        },
                        onError: (error) => {
                            const e = error as IErrorResponse
                            ErrorToast({message: "Не вдалося видалити завдання", error: e})
                        }
                    })}
                />}
        </>
    )
}