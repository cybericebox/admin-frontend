"use client"

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import React, {useState} from "react";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import {type IExerciseCategory} from "@/types/exercise";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import {AddIcon, DialogForm} from "@/components/common";
import ExerciseCategoryForm from "./CategoryForm";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";
import {useInView} from "@/hooks/useInView";

interface CategoriesTableProps {
    setSelectedCategory: (category: IExerciseCategory | undefined) => void
    selectedCategory?: IExerciseCategory
}

export default function CategoriesTable(props: CategoriesTableProps) {
    const {
        GetExerciseCategoriesRequest,
        GetExerciseCategoriesResponse,
        GetMoreExerciseCategoriesRequest
    } = useExerciseCategory().useGetExerciseCategories()
    const {DeleteExerciseCategory} = useExerciseCategory().useDeleteExerciseCategory()

    const [deleteExerciseCategoryDialog, setDeleteExerciseCategoryDialog] = useState<IExerciseCategory>()
    const [updateExerciseCategoryDialog, setUpdateExerciseCategoryDialog] = useState<IExerciseCategory>()
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetMoreExerciseCategoriesRequest.HasMore) {
                GetMoreExerciseCategoriesRequest.FetchMore()
            }
        },
        isLoading: GetExerciseCategoriesRequest.isLoading || GetMoreExerciseCategoriesRequest.isFetchingMore,
    });

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead
                            onClick={() => props.setSelectedCategory(undefined)}
                            aria-label="Show exercises of all categories"
                            data-tooltip-content="Показати всі завдання"
                            data-tooltip-id="tooltip"
                        >Назва категорії</TableHead>
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
                    GetExerciseCategoriesResponse?.Data &&
                    <TableBody
                        onEmpty={{
                            isLoading: GetExerciseCategoriesRequest.isLoading,
                            error: GetExerciseCategoriesRequest.error,
                            isEmpty: !GetExerciseCategoriesResponse?.Data.length,
                            noDataMessage: "Жодної категорії не створено",
                        }}
                        isFetchingMoreData={GetMoreExerciseCategoriesRequest.isFetchingMore}
                    >
                        {
                            GetExerciseCategoriesResponse?.Data.map((category, index) => {
                                return (
                                    <TableRow
                                        ref={GetExerciseCategoriesResponse.Data.length === index + 1 ? lastElementRef : null}
                                        key={category.ID}
                                        onClick={() => {
                                            props.selectedCategory?.ID === category.ID ?
                                                props.setSelectedCategory(undefined) :
                                                props.setSelectedCategory(category)
                                        }}
                                        className={props.selectedCategory?.ID === category.ID ? "bg-blue-100 hover:bg-blue-100" : ""}
                                        aria-label="Show exercises of the category"
                                        data-tooltip-content="Показати завдання відповідної категорії"
                                        data-tooltip-id="tooltip"
                                    >
                                        <TableCell
                                            onClick={() => setUpdateExerciseCategoryDialog(category)}
                                            aria-label="Edit category"
                                            data-tooltip-content="Показати категорію"
                                            data-tooltip-id="tooltip"
                                        >
                                            {category.Name}
                                        </TableCell>
                                        <TableCell>
                                            <DeleteIcon
                                                onClick={() => setDeleteExerciseCategoryDialog(category)}
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

            {!!deleteExerciseCategoryDialog &&
                <DeleteDialog
                    isOpen={!!deleteExerciseCategoryDialog}
                    onClose={() => setDeleteExerciseCategoryDialog(undefined)}
                    name={deleteExerciseCategoryDialog.Name}
                    description={"Впевнені? Всі дані категорії включаючи завдання будуть втрачені та не можуть бути відновлені."}
                    onDelete={() => DeleteExerciseCategory(deleteExerciseCategoryDialog.ID!, {
                        onSuccess: () => {
                            SuccessToast("Категорію успішно видалено")
                            // category was selected unselect it
                            if (props.selectedCategory?.ID === deleteExerciseCategoryDialog.ID) {
                                props.setSelectedCategory(undefined)
                            }
                        },
                        onError: (error) => {
                            ErrorToast("Не вдалося видалити категорію", {cause: error})
                        }
                    })}
                />}
            {!!updateExerciseCategoryDialog &&
                <DialogForm isOpen={!!updateExerciseCategoryDialog}
                            preventFocusOnOpen={true}
                            onClose={() => setUpdateExerciseCategoryDialog(undefined)}>
                    <ExerciseCategoryForm onClose={() => setUpdateExerciseCategoryDialog(undefined)}
                                          category={updateExerciseCategoryDialog}/>
                </DialogForm>
            }
            <DialogForm isOpen={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)}>
                <ExerciseCategoryForm onClose={() => setIsAddDialogOpen(false)}/>
            </DialogForm>
        </>
    )
}