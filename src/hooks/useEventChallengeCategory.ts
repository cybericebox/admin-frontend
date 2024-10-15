"use client"
import {useMutation, useQuery, useQueryClient, UseQueryResult} from "@tanstack/react-query";
import {
    createEventChallengeCategoryFn,
    deleteEventChallengeCategoryFn,
    getEventChallengeCategoriesFn,
    updateEventChallengeCategoriesOrderFn,
    updateEventChallengeCategoryFn
} from "@/api/eventCategoryChallengeAPI";
import {ChallengeCategorySchema, IEventChallengeCategory, IOrder} from "@/types/challenge";
import {forEach} from "lodash";
import {IResponse} from "@/types/api";
import {z} from "zod";

const useGetEventChallengeCategories = (eventID: string) => {
    const {data: GetEventChallengeCategoriesResponse, isLoading, isError, isSuccess, error} = useQuery({
        queryKey: ['eventChallengeCategories', eventID],
        queryFn: () => getEventChallengeCategoriesFn(eventID),
        enabled: !!eventID,
        select: (data) => {
            const res = z.array(ChallengeCategorySchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })
    const GetEventChallengeCategoriesRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }
    return {GetEventChallengeCategoriesResponse, GetEventChallengeCategoriesRequest}
}

const useCreateEventChallengeCategory = (eventID: string) => {
    const queryClient = useQueryClient()
    const {
        data: CreateEventChallengeCategoryResponse,
        isPending: PendingCreateEventChallengeCategory,
        mutate: CreateEventChallengeCategory,
    } = useMutation({
        mutationKey: ["createEventChallengeCategory"],
        mutationFn: async (data: IEventChallengeCategory) => await createEventChallengeCategoryFn(eventID, data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).catch((e: any) => console.log(e))
        }
    })

    return {
        CreateEventChallengeCategory,
        PendingCreateEventChallengeCategory,
        CreateEventChallengeCategoryResponse,
    }
}

const useUpdateEventChallengeCategory = (eventID: string) => {
    const queryClient = useQueryClient()
    const {
        data: UpdateEventChallengeCategoryResponse,
        isPending: PendingUpdateEventChallengeCategory,
        mutate: UpdateEventChallengeCategory
    } = useMutation({
        mutationKey: ["updateEventChallengeCategory"],
        mutationFn: async (data: IEventChallengeCategory) => await updateEventChallengeCategoryFn(data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).catch((e: any) => console.log(e))
        }
    })
    return {UpdateEventChallengeCategory, PendingUpdateEventChallengeCategory, UpdateEventChallengeCategoryResponse}
}

const useDeleteEventChallengeCategory = (eventID: string) => {
    const queryClient = useQueryClient()
    const {
        data: DeleteEventChallengeCategoryResponse,
        isPending: PendingDeleteEventChallengeCategory,
        mutate: DeleteEventChallengeCategory,
    } = useMutation({
        mutationKey: ["deleteEventChallengeCategory"],
        mutationFn: async (id: string) => await deleteEventChallengeCategoryFn(eventID, id),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).catch((e: any) => console.log(e))
        }
    })
    return {DeleteEventChallengeCategory, PendingDeleteEventChallengeCategory, DeleteEventChallengeCategoryResponse}
}

const useUpdateEventChallengeCategoriesOrder = (eventID: string) => {
    const queryClient = useQueryClient()
    const {
        data: UpdateEventChallengeCategoriesOrderResponse,
        isPending: PendingUpdateEventChallengeCategoriesOrder,
        mutate: UpdateEventChallengeCategoriesOrder
    } = useMutation({
        mutationKey: ["updateEventChallengeCategoryOrder"],
        mutationFn: async (data: IOrder[]) => await updateEventChallengeCategoriesOrderFn(eventID, data),
        onMutate: async (variables) => {
            await queryClient.cancelQueries({queryKey: ['eventChallengeCategories', eventID]}).catch((e: any) => console.log(e))
            queryClient.setQueryData(['eventChallengeCategories', eventID], (old: UseQueryResult<IResponse<IEventChallengeCategory[]>>) => {
                const newData = forEach(old.data?.Data, (category) => {
                    const index = variables.findIndex((item) => item.ID === category.ID)
                    if (index !== -1) {
                        category.Order = variables[index].Index
                    }
                    return category
                })?.sort((a, b) => a.Order - b.Order)
                old.data!.Data = newData!
                return old
            })
        },
        onError: () => {
            queryClient.invalidateQueries({queryKey: ['eventChallengeCategories', eventID]}).catch((e: any) => console.log(e))
        },
    })
    return {
        UpdateEventChallengeCategoriesOrder,
        PendingUpdateEventChallengeCategoriesOrder,
        UpdateEventChallengeCategoriesOrderResponse
    }
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
