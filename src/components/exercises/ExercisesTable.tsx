"use client"

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import React, {useState} from "react";
import type {IExercise, IExerciseCategory} from "@/types/exercise";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import {useExercise} from "@/hooks/useExercise";
import Link from "next/link";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";
import {useInView} from "@/hooks/useInView";

interface ExercisesTableProps {
    selectedCategory?: IExerciseCategory
    search: string
}

export default function ExercisesTable({selectedCategory, search}: ExercisesTableProps) {
    const {GetExercisesResponse, GetExercisesRequest, GetMoreExercisesRequest} = useExercise().useGetExercises({
        search,
        categoryID: selectedCategory?.ID
    })
    const {DeleteExercise} = useExercise().useDeleteExercise()
    const {GetExerciseCategoriesResponse} = useExerciseCategory().useGetExerciseCategories()
    const [deleteExerciseDialog, setDeleteExerciseDialog] = useState<IExercise>()

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetMoreExercisesRequest.HasMore) {
                GetMoreExercisesRequest.FetchMore()
            }
        },
        isLoading: GetExercisesRequest.isLoading || GetMoreExercisesRequest.isFetchingMore,
        deps: [search, selectedCategory?.ID]
    });

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Назва завдання</TableHead>
                        <TableHead>Категорія</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Задачі</TableHead>
                    </TableRow>
                </TableHeader>
                {
                    <TableBody
                        onEmpty={{
                            isLoading: GetExercisesRequest.isLoading,
                            error: GetExercisesRequest.error,
                            isEmpty: !GetExercisesResponse?.Data.length,
                            hasFilter: search.length > 0 || !!selectedCategory?.ID,
                            noDataMessage: "Жодного завдання не створено",
                            noFilteredDataMessage: "Завдань за запитом не знайдено"
                        }}
                        isFetchingMoreData={GetMoreExercisesRequest.isFetchingMore}
                    >
                        {
                            GetExercisesResponse?.Data.map((exercise, index) => {
                                const category = GetExerciseCategoriesResponse?.Data.find(category => category.ID === exercise.CategoryID)
                                return (
                                    <TableRow
                                        key={exercise.ID}
                                        ref={GetExercisesResponse.Data.length === index + 1 ? lastElementRef : null}
                                    >
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
            {!!deleteExerciseDialog &&
                <DeleteDialog
                    isOpen={!!deleteExerciseDialog}
                    onClose={() => setDeleteExerciseDialog(undefined)}
                    name={deleteExerciseDialog.Name}
                    description={"Впевнені? Всі дані будуть втрачені та не можуть бути відновлені."}
                    onDelete={() => DeleteExercise(deleteExerciseDialog.ID!, {
                        onSuccess: () => {
                            SuccessToast("Завдання успішно видалено")
                        },
                        onError: (error) => {
                            ErrorToast("Не вдалося видалити завдання", {cause: error})
                        }
                    })}
                />}
        </>
    )
}