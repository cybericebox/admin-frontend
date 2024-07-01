import type {Challenge} from "@/types/challenge";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import React, {useState} from "react";
import {Draggable} from "@hello-pangea/dnd";
import {useEventChallenge} from "@/hooks/useEventChallenge";

interface ChallengeCardProps {
    challenge: Challenge
    index: number
}

export default function ChallengeCard({challenge, index}: ChallengeCardProps) {
    const deleteChallenge = useEventChallenge().useDeleteEventChallenge(challenge.EventID!)
    const [challengeToDelete, setChallengeToDelete] = useState<Challenge>()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
    return (
        <Draggable draggableId={challenge.ID!} index={index}>
            {(provider) => (
                <div
                    {...provider.draggableProps}
                    {...provider.dragHandleProps}
                    ref={provider.innerRef}
                    className="bg-white shadow-md rounded-lg py-4 px-3 flex items-center justify-between w-full"
                >
                    <h2 className="text-lg font-semibold text-nowrap">{challenge.Name}</h2>
                    <DeleteIcon title={"Видалити завдання"} onClick={() => {
                        setChallengeToDelete(challenge)
                        setDeleteDialogOpen(true)
                    }}/>
                    {!!challengeToDelete &&
                        <DeleteDialog
                            isOpen={isDeleteDialogOpen}
                            onClose={() => setDeleteDialogOpen(false)}
                            name={challengeToDelete.Name}
                            description={"Впевнені? Всі дані завдання будуть втрачені та не можуть бути відновлені."}
                            onDelete={() => deleteChallenge.mutate(challengeToDelete.ID!)}
                        />}
                </div>
            )}
        </Draggable>
    )
}