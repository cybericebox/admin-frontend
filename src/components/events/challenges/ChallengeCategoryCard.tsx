import {ChallengeCategory} from "@/types/challenge";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import React, {useState} from "react";
import SelectChallengesDialog from "@/components/events/challenges/SelectChallengeDialog";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import ChallengeCard from "@/components/events/challenges/ChallengeCard";
import {Button} from "@/components/ui/button";
import {useEventChallengeCategory} from "@/hooks/useEventChallengeCategory";
import CategoryNameInput from "@/components/events/challenges/CategoryNameInput";
import {Draggable, Droppable} from "@hello-pangea/dnd";

interface ChallengeCategoryCardProps {
    category: ChallengeCategory
    index: number
}

export default function ChallengeCategoryCard({category, index}: ChallengeCategoryCardProps) {
    const getChallenges = useEventChallenge().useGetEventChallenges(category.EventID, category.ID)
    const deleteChallengeCategory = useEventChallengeCategory().useDeleteEventChallengeCategory(category.EventID!)
    const [isSelectDialogOpen, setIsSelectDialogOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<ChallengeCategory>()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
    return (
        <Draggable draggableId={category.ID!} index={index}>
            {(provider) => (
                <div
                    {...provider.draggableProps}
                    {...provider.dragHandleProps}
                    ref={provider.innerRef}
                    className="bg-gray-50 shadow-md rounded-lg py-4 px-3 flex flex-col h-full"
                >
                    <div className={"flex items-center justify-between w-full mb-4"}>
                        <CategoryNameInput category={category}/>
                        <DeleteIcon title={"Видалити категорію"} onClick={() => {
                            setCategoryToDelete(category)
                            setDeleteDialogOpen(true)
                        }}/>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                        <Droppable droppableId={category.ID!} type={"challenge"} direction={"vertical"}>
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="w-full flex flex-col gap-2 items-center overflow-y-auto"
                                >
                                    {getChallenges.data?.length ? getChallenges.data?.map((challenge, index) => (
                                        <ChallengeCard challenge={challenge} key={challenge.ID!} index={index}/>
                                    )) : <div className={"text-gray-400"}>Немає завдань</div>}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                        <Button
                            className={"w-full"}
                            onClick={() => setIsSelectDialogOpen(true)}
                        >
                            Додати завдання
                        </Button>
                    </div>
                    <SelectChallengesDialog isOpen={isSelectDialogOpen} onClose={() => setIsSelectDialogOpen(false)}
                                            order={getChallenges.data?.length || 0} categoryID={category.ID!}
                                            eventID={category.EventID}/>
                    {!!categoryToDelete &&
                        <DeleteDialog
                            isOpen={isDeleteDialogOpen}
                            onClose={() => setDeleteDialogOpen(false)}
                            name={categoryToDelete.Name}
                            description={"Впевнені? Всі дані категорії включаючи завдання будуть втрачені та не можуть бути відновлені."}
                            onDelete={() => deleteChallengeCategory.mutate(categoryToDelete.ID!)}
                        />}
                </div>)}
        </Draggable>
    );
}