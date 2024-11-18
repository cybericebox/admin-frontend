"use client"
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
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
        error
    } = useQuery({
        queryKey: ['eventChallengeSolutionAttempts', eventID],
        queryFn: () => getEventChallengeSolutionAttemptsFn(eventID),
        enabled: !!eventID,
        select: (data) => {
            const res = z.array(ChallengeSolutionAttemptSchema).safeParse(data.data.Data)
            if (!res.success) {
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })

    const GetEventChallengeSolutionAttemptsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetEventChallengeSolutionAttemptsResponse, GetEventChallengeSolutionAttemptsRequest}
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
    return {UpdateEventChallengeSolutionAttemptStatus, UpdateEventChallengeSolutionAttemptStatusResponse, PendingUpdateEventChallengeSolutionAttemptStatus, UpdateEventChallengeSolutionAttemptStatusError}
}
export const useEventChallengeSolutionAttempt = () => {
    return {
        useGetEventChallengeSolutionAttempts,
        useUpdateEventChallengeSolutionAttemptStatus
    }
}
