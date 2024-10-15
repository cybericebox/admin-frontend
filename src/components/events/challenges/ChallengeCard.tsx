import type {IEventChallenge} from "@/types/challenge";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import React, {useState} from "react";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import {cn} from "@/utils/cn";
import toast from "react-hot-toast";
import {IErrorResponse} from "@/types/api";
import {GripVertical} from "lucide-react";
import {ErrorToast} from "@/components/common/errorToast";

interface ChallengeCardProps {
    challenge: IEventChallenge
}

export default function ChallengeCard({challenge}: ChallengeCardProps) {
    const {DeleteEventChallenge} = useEventChallenge().useDeleteEventChallenge(challenge.EventID!)
    const [deleteEventChallengeDialog, setDeleteEventChallengeDialog] = useState<IEventChallenge>()
    const [showIcon, setShowIcon] = useState<boolean>(false)
    return (
        <div
            className="bg-white shadow-md rounded-lg py-4 px-3 pr-9 flex items-center justify-between w-full relative"
            onMouseOver={() => setShowIcon(true)}
            onMouseLeave={() => setShowIcon(false)}
        >
            <div
                className="text-lg font-semibold text-nowrap mx-6"
                aria-label={"Challenge details"}
                data-tooltip-html={`<div class="ProseMirror">${challenge.Data.Description}</div>`}
                data-tooltip-id={"challenge-tooltip"}
            >{challenge.Data.Name}</div>
            <GripVertical
                className={"absolute top-[25%] left-2"}
            />
            <DeleteIcon
                title={"Видалити завдання"}
                onClick={() => {
                    setDeleteEventChallengeDialog(challenge)
                }}
                className={cn("absolute right-2", !showIcon && "hidden")}
            />
            {!!deleteEventChallengeDialog &&
                <DeleteDialog
                    isOpen={!!deleteEventChallengeDialog}
                    onClose={() => setDeleteEventChallengeDialog(undefined)}
                    name={deleteEventChallengeDialog.Data.Name}
                    description={"Впевнені? Всі дані завдання будуть втрачені та не можуть бути відновлені."}
                    onDelete={() => DeleteEventChallenge(deleteEventChallengeDialog.ID!, {
                        onSuccess: () => {
                            toast.success("Завдання успішно видалено")
                        },
                        onError: (error) => {
                            const e = error as IErrorResponse
                            ErrorToast({message: "Не вдалося видалити завдання", error: e})
                        }
                    })}
                />}
        </div>
    )
}