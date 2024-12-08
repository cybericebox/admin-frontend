"use client"
import {useInfiniteQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {z} from "zod";
import {type IParticipant, ParticipantSchema,} from "@/types/event";
import {
    createEventParticipantFn,
    deleteEventParticipantFn,
    getEventParticipantsFn,
    updateEventParticipantStatusFn,
    updateEventParticipantTeamFn
} from "@/api/eventParticipantAPI";
import {ErrorInvalidResponseData} from "@/types/common";

const useGetEventParticipants = (eventID: string) => {
    const {
        data: GetEventParticipantsResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        fetchNextPage: FetchMore,
        hasNextPage: HasMore,
        isFetchingNextPage: isFetchingMore,
    } = useInfiniteQuery({
        queryKey: ['eventParticipants', eventID],
        queryFn: ({pageParam}) => getEventParticipantsFn({eventID, page: pageParam}),
        enabled: !!eventID,
        select: (data) => {
            data.pages.forEach((page) => {
                const res = z.array(ParticipantSchema).safeParse(page.data.Data)
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

    const GetEventParticipantsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    const GetModeEventParticipantsRequest = {
        isFetchingMore,
        HasMore,
        FetchMore,
    }

    return {GetEventParticipantsResponse, GetEventParticipantsRequest, GetModeEventParticipantsRequest}
}

const useCreateEventParticipant = () => {
    const queryClient = useQueryClient()
    const {
        mutate: CreateEventParticipant,
        data: CreateEventParticipantResponse,
        isPending: PendingCreateEventParticipant,
        error: CreateEventParticipantError
    } = useMutation({
        mutationKey: ["createEventParticipant"],
        mutationFn: async (data: IParticipant) => await createEventParticipantFn(data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({queryKey: ['eventParticipants', variables.EventID]}).catch((e) => console.log(e))
        }
    })
    return {
        CreateEventParticipant,
        CreateEventParticipantResponse,
        PendingCreateEventParticipant,
        CreateEventParticipantError
    }
}

const useUpdateEventParticipantStatus = () => {
    const queryClient = useQueryClient()
    const {
        mutate: UpdateEventParticipantStatus,
        data: UpdateEventParticipantStatusResponse,
        isPending: PendingUpdateEventParticipantStatus,
        error: UpdateEventParticipantStatusError
    } = useMutation({
        mutationKey: ["updateEventParticipantStatus"],
        mutationFn: async (data: IParticipant) => await updateEventParticipantStatusFn(data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({queryKey: ['eventParticipants', variables.EventID]}).catch((e) => console.log(e))
        }
    })
    return {
        UpdateEventParticipantStatus,
        UpdateEventParticipantStatusResponse,
        PendingUpdateEventParticipantStatus,
        UpdateEventParticipantStatusError
    }
}

const useUpdateEventParticipantTeam = () => {
    const queryClient = useQueryClient()
    const {
        mutate: UpdateEventParticipantTeam,
        data: UpdateEventParticipantTeamResponse,
        isPending: PendingUpdateEventParticipantTeam,
        error: UpdateEventParticipantTeamError
    } = useMutation({
        mutationKey: ["updateEventParticipantTeam"],
        mutationFn: async (data: IParticipant) => await updateEventParticipantTeamFn(data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({queryKey: ['eventParticipants', variables.EventID]}).catch((e) => console.log(e))
        }
    })
    return {
        UpdateEventParticipantTeam,
        UpdateEventParticipantTeamResponse,
        PendingUpdateEventParticipantTeam,
        UpdateEventParticipantTeamError
    }
}

const useDeleteEventParticipant = () => {
    const queryClient = useQueryClient()
    const {
        mutate: DeleteEventParticipant,
        data: DeleteEventParticipantResponse,
        isPending: PendingDeleteEventParticipant,
        error: DeleteEventParticipantError
    } = useMutation({
        mutationKey: ["deleteEventParticipant"],
        mutationFn: async (data: IParticipant) => await deleteEventParticipantFn(data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({queryKey: ['eventParticipants', variables.EventID]}).catch((e) => console.log(e))
        }
    })
    return {
        DeleteEventParticipant,
        DeleteEventParticipantResponse,
        PendingDeleteEventParticipant,
        DeleteEventParticipantError
    }
}

export const useEventParticipant = () => {
    return {
        useGetEventParticipants,
        useCreateEventParticipant,
        useUpdateEventParticipantStatus,
        useUpdateEventParticipantTeam,
        useDeleteEventParticipant
    }
};
