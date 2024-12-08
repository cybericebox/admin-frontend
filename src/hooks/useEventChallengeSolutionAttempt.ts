"use client"
import {useInfiniteQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {z} from "zod";
import {
    getEventChallengeSolutionAttemptsFn,
    updateEventChallengeSolutionAttemptStatusFn
} from "@/api/eventChallengeSolutionAPI";
import {ChallengeSolutionAttemptSchema, type IEventChallengeSolutionAttempt} from "@/types/challenge";
import {ErrorInvalidResponseData} from "@/types/common";

const useGetEventChallengeSolutionAttempts = (eventID: string) => {
    const {
        data: GetEventChallengeSolutionAttemptsResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        fetchNextPage: FetchMore,
        hasNextPage: HasMore,
        isFetchingNextPage: isFetchingMore,
    } = useInfiniteQuery({
        queryKey: ['eventChallengeSolutionAttempts', eventID],
        queryFn: ({pageParam}) => getEventChallengeSolutionAttemptsFn({eventID, page: pageParam}),
        enabled: !!eventID,
        select: (data) => {
            data.pages.forEach((page) => {
                const res = z.array(ChallengeSolutionAttemptSchema).safeParse(page.data.Data)
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

    const GetEventChallengeSolutionAttemptsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    const GetMoreEventChallengeSolutionAttemptsRequest = {
        isFetchingMore,
        HasMore,
        FetchMore,
    }

    return {
        GetEventChallengeSolutionAttemptsResponse,
        GetEventChallengeSolutionAttemptsRequest,
        GetMoreEventChallengeSolutionAttemptsRequest
    }
}

const useUpdateEventChallengeSolutionAttemptStatus = () => {
    const queryClient = useQueryClient()
    const {
        mutate: UpdateEventChallengeSolutionAttemptStatus,
        data: UpdateEventChallengeSolutionAttemptStatusResponse,
        isPending: PendingUpdateEventChallengeSolutionAttemptStatus,
        error: UpdateEventChallengeSolutionAttemptStatusError
    } = useMutation({
        mutationKey: ["updateEventChallengeSolutionAttemptStatus"],
        mutationFn: async (data: IEventChallengeSolutionAttempt) => await updateEventChallengeSolutionAttemptStatusFn(data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({queryKey: ['eventChallengeSolutionAttempts', variables.EventID]}).catch((e) => console.log(e))
        }
    })
    return {
        UpdateEventChallengeSolutionAttemptStatus,
        UpdateEventChallengeSolutionAttemptStatusResponse,
        PendingUpdateEventChallengeSolutionAttemptStatus,
        UpdateEventChallengeSolutionAttemptStatusError
    }
}
export const useEventChallengeSolutionAttempt = () => {
    return {
        useGetEventChallengeSolutionAttempts,
        useUpdateEventChallengeSolutionAttemptStatus
    }
}
