"use client"

import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import React, {useState} from "react";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import {ExerciseCategory} from "@/types/exercise";
import {BodyContent} from "@/components/common/page";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import AddIcon from "@/components/common/AddIcon";
import CreateCategoryDialog from "@/components/exercises/CreateCategoryDialog";

interface CategoriesTableProps {
    setSelectedCategory?: (category: ExerciseCategory) => void
}

export default function CategoriesTable(props: CategoriesTableProps) {
    const getExerciseCategories = useExerciseCategory().useGetExerciseCategories()
    const deleteExerciseCategory = useExerciseCategory().useDeleteExerciseCategory()

    const [categoryToDelete, setCategoryToDelete] = useState<ExerciseCategory>()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)


    const openDeleteDialog = (category: ExerciseCategory) => {
        setCategoryToDelete(category)
        setDeleteDialogOpen(true)
    }
    return (
        <div className={"h-full w-full flex flex-col"}>
            {/*<BodyHeader title={"Категорії"} textSize={"text-lg"}/>*/}
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow>
                            <TableHead>Назва категорії</TableHead>
                            <TableHead>
                                <AddIcon
                                    key={"Add category"}
                                    title={"Додати категорію"}
                                    onClick={() => setIsAddDialogOpen(true)}
                                />

                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        getExerciseCategories.data &&
                        <TableBody className={styles.tableBody}>
                            {
                                getExerciseCategories.data?.map((category) => {
                                    return (
                                        <TableRow key={category.ID}>
                                            <TableCell>
                                                {category.Name}
                                            </TableCell>
                                            <TableCell>
                                                <DeleteIcon
                                                    onClick={() => openDeleteDialog(category)}
                                                    title={"Видалити категорію"}
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
                        getExerciseCategories.isLoading ?
                            "Завантаження..." :
                            getExerciseCategories.isError ?
                                "Помилка завантаження" :
                                getExerciseCategories.isSuccess && getExerciseCategories.data.length === 0 ?
                                    "Жодної категорії не створено" :
                                    null
                    }
                </div>
            </BodyContent>
            {!!categoryToDelete &&
                <DeleteDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    name={categoryToDelete.Name}
                    description={"Впевнені? Всі дані категорії включаючи завдання та учасники будуть втрачені та не можуть бути відновлені."}
                    onDelete={() => deleteExerciseCategory.mutate(categoryToDelete.ID!)}
                />}
            <CreateCategoryDialog isOpen={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)}/>
        </div>
    )
}