"use client"
import React, {useState} from "react";
import {Search} from "@/components/common";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Checkbox} from "@/components/ui/checkbox";
import {Button} from "@/components/ui/button";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";
import {useInView} from "@/hooks/useInView";

export interface SelectChallengeFormProps {
    eventID: string
    categoryID: string
    onCancel?: () => void
}

export default function SelectChallengesForm({eventID, categoryID, onCancel}: SelectChallengeFormProps) {
    const [search, setSearch] = useState("")
    const {GetExerciseCategoriesResponse} = useExerciseCategory().useGetExerciseCategories()
    const {
        GetAvailableExercisesRequest,
        GetAvailableExercisesResponse,
        GetMoreAvailableExercisesRequest
    } = useEventChallenge().useGetAvailableExercises({
        search,
        eventID
    })
    const [selectedExerciseIDs, setSelectedExerciseIDs] = useState<string[]>([])
    const {CreateEventChallenge} = useEventChallenge().useCreateEventChallenge(eventID)

    const onCreateChallenge = () => {
        CreateEventChallenge({
            CategoryID: categoryID,
            ExerciseIDs: selectedExerciseIDs,
        }, {
            onSuccess: () => {
                SuccessToast("Завдання успішно додані")
                onCancel?.()
            },
            onError: (error) => {
                ErrorToast("Не вдалося додати завдання", {cause: error})
            }
        })
    }

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetMoreAvailableExercisesRequest.HasMore) {
                GetMoreAvailableExercisesRequest.FetchMore()
            }
        },
        isLoading: GetAvailableExercisesRequest.isLoading || GetMoreAvailableExercisesRequest.isFetchingMore,
        deps: [search]
    });

    return (
        <div className={"flex flex-col short:space-y-1 space-y-3 h-[calc(80dvh-1.5rem)] sm:h-[calc(80dvh-3.5rem)] w-[calc(100dvw-1rem)] sm:w-[calc(80dvw-3rem)]"}>
            <BodyHeader title={"Завдання"}>
                <Search setSearch={setSearch} placeholder={"Знайти завдання"} key={"search"}/>
            </BodyHeader>
            <BodyContent className={"flex flex-col sm:gap-6 gap-2"}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={"text-center"}>Обрати</TableHead>
                            <TableHead>Назва завдання</TableHead>
                            <TableHead>Категорія</TableHead>
                            <TableHead>Тип</TableHead>
                            <TableHead>Задачі</TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        <TableBody
                            onEmpty={{
                                isLoading: GetAvailableExercisesRequest.isLoading,
                                error: GetAvailableExercisesRequest.error,
                                isEmpty: !GetAvailableExercisesResponse?.Data.length,
                                hasFilter: !!search.length,
                                noDataMessage: "Жодного завдання не створено",
                                noFilteredDataMessage: "Завдань за запитом не знайдено"
                            }}
                            isFetchingMoreData={GetMoreAvailableExercisesRequest.isFetchingMore}
                        >
                            {
                                GetAvailableExercisesResponse?.Data.map((exercise, index) => {
                                    const category = GetExerciseCategoriesResponse?.Data.find(category => category.ID === exercise.CategoryID)
                                    return (
                                        <TableRow
                                            key={exercise.ID}
                                            ref={GetAvailableExercisesResponse.Data.length === index + 1 ? lastElementRef : null}
                                        >
                                            <TableCell className={"text-center"}>
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
                <Button
                    onClick={() => {
                        onCreateChallenge()
                    }}
                >
                    Додати завдання
                </Button>
            </BodyContent>

        </div>

    )
}