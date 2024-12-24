import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {
    createEventChallengeFn,
    deleteEventChallengeFn,
    getAvailableExercisesFn,
    getEventChallengesFn,
    updateEventChallengesOrderFn
} from "@/api/eventChallengeAPI";
import {ChallengeSchema, ICreateEventChallenge, IEventChallenge, IOrder} from "@/types/challenge";
import {getEventChallengeCategoriesFn} from "@/api/eventCategoryChallengeAPI";
import {z} from "zod";
import {ErrorInvalidResponseData} from "@/types/common";
import {ExercisePreprocessedSchema} from "@/types/exercise";

const useGetEventChallenges = (eventID: string) => {
    const queryClient = useQueryClient();
    const {
        data: GetEventChallengesResponse,
        isLoading,
        isError,
        isSuccess,
        error
    } = useQuery({
        queryKey: ['eventChallenges', eventID],
        queryFn: () => getEventChallengesFn(eventID),
        enabled: !!eventID,
        select: (data) => {
            const res = z.array(ChallengeSchema).safeParse(data.data.Data)
            if (!res.success) {
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            queryClient.ensureQueryData({
                queryKey: ['eventChallengeCategories', eventID],
                queryFn: () => getEventChallengeCategoriesFn(eventID),
            }).then((categoriesResponse) => {
                let categoriesMap: Record<string, IEventChallenge[]> = {}
                for (let category of categoriesResponse.data.Data) {
                    queryClient.setQueryData(['eventChallenges', eventID, "categories", category.ID], [])
                }
                data.data.Data.forEach((challenge) => {
                    if (!categoriesMap[challenge.CategoryID]) {
                        categoriesMap[challenge.CategoryID] = []
                    }
                    categoriesMap[challenge.CategoryID].push(challenge)
                })
                for (let key in categoriesMap) {
                    categoriesMap[key] = categoriesMap[key].sort((a, b) => a.Order - b.Order)
                }
                for (let key in categoriesMap) {
                    queryClient.setQueryData(['eventChallenges', eventID, "categories", key], categoriesMap[key])
                }
            })

            return data.data
        }
    })

    const GetEventChallengesRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetEventChallengesResponse, GetEventChallengesRequest}
}

interface getAvailableExercises {
    eventID: string
    search: string
}

const useGetAvailableExercises = ({eventID, search}: getAvailableExercises) => {
    const {
        data: GetAvailableExercisesResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        fetchNextPage: FetchMore,
        hasNextPage: HasMore,
        isFetchingNextPage: isFetchingMore,
    } = useInfiniteQuery({
        queryKey: ['availableExercises', eventID, search],
        queryFn: ({pageParam}) => getAvailableExercisesFn({eventID, search, page: pageParam}),
        enabled: !!eventID,
        select: (data) => {
            data.pages.forEach((page) => {
                const res = z.array(ExercisePreprocessedSchema).safeParse(page.data.Data)
                if (!res.success) {
                    console.log(res.error)
                    throw ErrorInvalidResponseData
                } else {
                    page.data.Data = res.data
                }
            })

            return {
                Status: data.pages[data.pages.length - 1]?.data?.Status,
                Data: data.pages.map((page) => page.data.Data).flat()
            }
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            if (!lastPage?.data?.Data?.length) {
                return undefined
            }

            return lastPageParam + 1
        },
    })

    const GetAvailableExercisesRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    const GetMoreAvailableExercisesRequest = {
        isFetchingMore,
        HasMore,
        FetchMore,
    }

    return {GetAvailableExercisesResponse, GetAvailableExercisesRequest, GetMoreAvailableExercisesRequest}
}

const useGetEventChallengesByCategory = (eventID: string, categoryID: string) => {
    const {
        data: GetEventChallengesByCategoryResponse,
    } = useQuery({
        queryKey: ['eventChallenges', eventID, "categories", categoryID],
        enabled: false,
        select: (data: IEventChallenge[]) => {
            if (!data) {
                return []
            }
            return data
        }
    })

    return {GetEventChallengesByCategoryResponse}
}

const useCreateEventChallenge = (eventID: string) => {
    const queryClient = useQueryClient();
    const {
        mutate: CreateEventChallenge,
        isPending: PendingCreateEventChallenge,
        data: CreateEventChallengeResponse
    } = useMutation({
        mutationKey: ['createEventChallenge'],
        mutationFn: (data: ICreateEventChallenge) => createEventChallengeFn(eventID, data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['eventChallenges', eventID]}).catch((e: any) => console.log(e))
        }
    })

    return {CreateEventChallenge, PendingCreateEventChallenge, CreateEventChallengeResponse}
}

const useDeleteEventChallenge = (eventID: string) => {
    const queryClient = useQueryClient();
    const {
        mutate: DeleteEventChallenge,
        isPending: PendingDeleteEventChallenge,
        data: DeleteEventChallengeResponse
    } = useMutation({
        mutationKey: ['deleteEventChallenge'],
        mutationFn: (challengeID: string) => deleteEventChallengeFn(eventID, challengeID),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['eventChallenges', eventID]}).catch((e: any) => console.log(e))
        },
    })

    return {DeleteEventChallenge, PendingDeleteEventChallenge, DeleteEventChallengeResponse}
}

const useUpdateEventChallengesOrder = (eventID: string) => {
    const queryClient = useQueryClient();
    const {
        mutate: UpdateEventChallengesOrder,
        isPending: PendingUpdateEventChallengesOrder,
        data: UpdateEventChallengesOrderResponse
    } = useMutation({
        mutationKey: ['updateEventChallengesOrder'],
        mutationFn: (data: IOrder[]) => updateEventChallengesOrderFn(eventID, data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['eventChallenges', eventID]}).catch((e: any) => console.log(e))
        }
    })

    return {UpdateEventChallengesOrder, PendingUpdateEventChallengesOrder, UpdateEventChallengesOrderResponse}
}

export const useEventChallenge = () => {
    return {
        useGetEventChallenges,
        useGetAvailableExercises,
        useGetEventChallengesByCategory,
        useCreateEventChallenge,
        useDeleteEventChallenge,
        useUpdateEventChallengesOrder,
    }
};
