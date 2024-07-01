"use client"
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {
    createEventChallengeCategoryFn,
    deleteEventChallengeCategoryFn,
    getEventChallengeCategoriesFn,
    UpdateEventChallengeCategoriesOrderData,
    updateEventChallengeCategoriesOrderFn,
    updateEventChallengeCategoryFn
} from "@/api/eventCategoryChallengeAPI";
import {ChallengeCategory} from "@/types/challenge";
import toast from "react-hot-toast";

const useGetEventChallengeCategories = (eventID: string) => {
    return useQuery({
        queryKey: ['eventChallengeCategories', eventID],
        queryFn: () => getEventChallengeCategoriesFn(eventID),
    })
}

const useCreateEventChallengeCategory = (eventID: string) => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["createEventChallengeCategory"],
        mutationFn: async (data: ChallengeCategory) => await createEventChallengeCategoryFn(eventID, data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).then(() => {
                toast.success("Категорію успішно створено", {})
            }).catch((e: any) => console.log(e))
        }
    })
}

const useUpdateEventChallengeCategory = (eventID: string) => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["updateEventChallengeCategory"],
        mutationFn: async (data: ChallengeCategory) => await updateEventChallengeCategoryFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).then(() => {
                toast.success("Категорію успішно оновлено", {})
            }).catch((e: any) => console.log(e))
        }
    })

}

const useDeleteEventChallengeCategory = (eventID: string) => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["deleteEventChallengeCategory"],
        mutationFn: async (id: string) => await deleteEventChallengeCategoryFn(eventID, id),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).then(() => {
                toast.success("Категорію успішно видалено", {})
            }).catch((e: any) => console.log(e))
        }
    })
}

const useUpdateEventChallengeCategoriesOrder = (eventID: string) => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["updateEventChallengeCategoryOrder"],
        mutationFn: async (data: UpdateEventChallengeCategoriesOrderData) => await updateEventChallengeCategoriesOrderFn(eventID, data),
        onMutate: async (variables) => {
            await client.cancelQueries({queryKey: ['eventChallengeCategories', eventID]}).catch((e: any) => console.log(e))
            client.setQueryData(['eventChallengeCategories', eventID], (old: ChallengeCategory[]) => [...old].sort((a, b) => a.Order - b.Order))
        },
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).catch((e: any) => console.log(e))
        }
    })
}

export const useEventChallengeCategory = () => {
    return {
        useGetEventChallengeCategories,
        useCreateEventChallengeCategory,
        useUpdateEventChallengeCategory,
        useDeleteEventChallengeCategory,
        useUpdateEventChallengeCategoriesOrder,
    }
};
