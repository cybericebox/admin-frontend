    "use client"
import {IEventChallengeCategory} from "@/types/challenge";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import React, {useState} from "react";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import ChallengeCard from "@/components/events/challenges/ChallengeCard";
import {Button} from "@/components/ui/button";
import {useEventChallengeCategory} from "@/hooks/useEventChallengeCategory";
import CategoryNameInput from "@/components/events/challenges/CategoryNameInput";
import {Draggable, Droppable} from "@hello-pangea/dnd";
import {cn} from "@/utils/cn";
import DialogForm from "@/components/common/form/DialogForm";
import SelectChallengesForm from "@/components/events/challenges/SelectChallengeForm";
import {GripVertical} from "lucide-react";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";


interface ChallengeCategoryCardProps {
    category: IEventChallengeCategory
    index: number

}

export default function ChallengeCategoryCard({category, index}: ChallengeCategoryCardProps) {
    const {GetEventChallengesByCategoryResponse} = useEventChallenge().useGetEventChallengesByCategory(category.EventID, category.ID!)
    const {DeleteEventChallengeCategory} = useEventChallengeCategory().useDeleteEventChallengeCategory(category.EventID!)
    const [isSelectChallengesDialogOpen, setIsSelectChallengesDialogOpen] = useState(false)
    const [showIcon, setShowIcon] = useState<boolean>(false)
    const [deleteEventChallengeCategoryDialog, setDeleteEventChallengeCategoryDialog] = useState<IEventChallengeCategory>()

    return (
        <Draggable
            key={category.ID}
            draggableId={category.ID!.toString()}
            index={index}
        >
            {provided => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="bg-gray-50 shadow-md rounded-lg pt-2 pb-4 px-3 flex flex-col relative h-fit"
                    onMouseOver={() => setShowIcon(true)}
                    onMouseLeave={() => setShowIcon(false)}
                >
                    <DeleteIcon
                        title={"Видалити категорію"}
                        onClick={() => {
                            setDeleteEventChallengeCategoryDialog(category)
                        }}
                        className={cn("absolute top-4 right-2", !showIcon && "hidden")}
                    />
                    <GripVertical
                        className={"absolute top-3 left-2"}
                    />

                    <CategoryNameInput category={category} className={"mb-4 mx-5"}/>
                    <div className="flex flex-col gap-2 items-center">
                        <Droppable droppableId={category.ID!.toString()} type={"challenge"}>
                            {(provided) => (
                                <div
                                    key={category.ID}
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="w-full flex flex-col gap-2 items-center"
                                >
                                    {GetEventChallengesByCategoryResponse?.length ? GetEventChallengesByCategoryResponse.map((challenge, index) => (
                                        <Draggable
                                            key={challenge.ID}
                                            draggableId={challenge.ID!.toString()}
                                            index={index}
                                        >
                                            {provided => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className="w-full"
                                                >
                                                    <ChallengeCard challenge={challenge}/>
                                                </div>
                                            )}
                                        </Draggable>
                                    )) : <div className={"text-gray-400"}>Немає завдань</div>}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                        <Button
                            className={"w-full"}
                            onClick={() => setIsSelectChallengesDialogOpen(true)}
                        >
                            Додати завдання
                        </Button>
                    </div>
                    <DialogForm isOpen={isSelectChallengesDialogOpen}
                                onClose={() => setIsSelectChallengesDialogOpen(false)}
                                className={"h-[80dvh] p-2 sm:p-6 max-w-full sm:max-w-[80dvw]"}>
                        <SelectChallengesForm eventID={category.EventID} categoryID={category.ID!}
                                              onCancel={() => setIsSelectChallengesDialogOpen(false)}/>
                    </DialogForm>
                    {!!deleteEventChallengeCategoryDialog &&
                        <DeleteDialog
                            isOpen={!!deleteEventChallengeCategoryDialog}
                            onClose={() => setDeleteEventChallengeCategoryDialog(undefined)}
                            name={deleteEventChallengeCategoryDialog.Name}
                            description={"Впевнені? Всі дані категорії включаючи завдання будуть втрачені та не можуть бути відновлені."}
                            onDelete={() => DeleteEventChallengeCategory(deleteEventChallengeCategoryDialog.ID!, {
                                onSuccess: () => {
                                    SuccessToast("Категорію успішно видалено")
                                },
                                onError: (error) => {
                                    ErrorToast("Не вдалося видалити категорію", {cause: error})
                                }
                            })}
                        />
                    }
                </div>

            )}
        </Draggable>

    );
}