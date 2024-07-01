"use client"

import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import React, {useState} from "react";
import {Exercise, ExerciseCategory} from "@/types/exercise";
import {BodyContent} from "@/components/common/page";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import {useExercise} from "@/hooks/useExercise";
import Link from "next/link";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";

interface ExercisesTableProps {
    selectedCategory?: ExerciseCategory
}

export default function ExercisesTable(props: ExercisesTableProps) {
    const getExercises = useExercise().useGetExercises()
    const deleteExercise = useExercise().useDeleteExercise()

    const [exerciseToDelete, setExerciseToDelete] = useState<Exercise>()
    const getExerciseCategories = useExerciseCategory().useGetExerciseCategories()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)

    const openDeleteDialog = (exercise: Exercise) => {
        setExerciseToDelete(exercise)
        setDeleteDialogOpen(true)
    }
    return (
        <>
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow>
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
                                                <Link
                                                    href={"/exercises/" + exercise.ID}
                                                    color="#54616e"
                                                    aria-label={"Exercise settings"}
                                                    data-tooltip-content="Перейти до налаштувань завдання"
                                                    data-tooltip-effect="solid"
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
                                                <DeleteIcon
                                                    onClick={() => openDeleteDialog(exercise)}
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
                        getExercises.isLoading ?
                            "Завантаження..." :
                            getExercises.isError ?
                                "Помилка завантаження" :
                                getExercises.isSuccess && getExercises.data.length === 0 ?
                                    "Жодного завдання не створено" :
                                    null
                    }
                </div>
            </BodyContent>
            {!!exerciseToDelete &&
                <DeleteDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    name={exerciseToDelete.Name}
                    description={"Впевнені? Всі дані будуть втрачені та не можуть бути відновлені."}
                    onDelete={() => deleteExercise.mutate(exerciseToDelete.ID!)}
                />}
        </>
    )
}