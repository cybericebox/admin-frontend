import {Input} from "@/components/ui/input";
import React, {useState} from "react";
import {type IEventChallengeCategory} from "@/types/challenge";
import {useEventChallengeCategory} from "@/hooks/useEventChallengeCategory";
import {cn} from "@/utils/cn";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";

interface CategoryNameInputProps {
    category: IEventChallengeCategory
    className?: string

}

export default function CategoryNameInput({category, className}: CategoryNameInputProps) {
    const {UpdateEventChallengeCategory} = useEventChallengeCategory().useUpdateEventChallengeCategory(category.EventID!)
    const [name, setName] = useState<string>(category.Name)
    const [active, setActive] = useState<boolean>(false)
    return (
        <Input
            value={name}
            onChange={(e) => {
                setName(e.target.value)
            }}
            className={cn("w-fit text-xl font-bold text-nowrap", !active && "border-0 shadow-none", className)}
            onFocus={() => setActive(true)}
            onBlur={() => {
                if (name !== category.Name) {
                    UpdateEventChallengeCategory({...category, Name: name}, {
                        onSuccess: () => {
                            setActive?.(false)
                            SuccessToast("Назву категорії успішно змінено")
                        },
                        onError: (error) => {
                            setName(category.Name)
                            ErrorToast("Не вдалося змінити назву категорії", {cause: error})
                        }
                    })
                }
                setActive(false)
            }}
        />
    )
}