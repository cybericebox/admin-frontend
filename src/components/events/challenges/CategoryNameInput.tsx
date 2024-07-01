import {Input} from "@/components/ui/input";
import React, {useState} from "react";
import {ChallengeCategory} from "@/types/challenge";
import {useEventChallengeCategory} from "@/hooks/useEventChallengeCategory";
import cn from "classnames";

interface CategoryNameInputProps {
    category: ChallengeCategory

}

export default function CategoryNameInput({category}: CategoryNameInputProps) {
    const updateChallengeCategory = useEventChallengeCategory().useUpdateEventChallengeCategory(category.EventID!)
    const [editName, setEditName] = useState(false)
    const [name, setName] = useState<string>(category.Name)
    return (
        <Input
            value={name}
            onChange={(e) => {
                setName(e.target.value)
            }}
            onFocus={() => setEditName(true)}
            className={cn("w-full text-xl font-bold text-nowrap min-w-72", {"border-0 shadow-none": !editName})}
            onBlur={() => {
                if (name !== category.Name) {
                    updateChallengeCategory.mutate({...category, Name: name})
                }
                setEditName(false)
            }}
        />
    )
}