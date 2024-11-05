"use client"
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {z} from "zod";
import {type IParticipant, ParticipantSchema,} from "@/types/event";
import {
    createEventParticipantFn, deleteEventParticipantFn,
    getEventParticipantsFn,
    updateEventParticipantStatusFn, updateEventParticipantTeamFn
} from "@/api/eventParticipantAPI";

const useGetEventParticipants = (eventID: string) => {
    const {
        data: GetEventParticipantsResponse,
        isLoading,
        isError,
        isSuccess,
        error
    } = useQuery({
        queryKey: ['eventParticipants', eventID],
        queryFn: () => getEventParticipantsFn(eventID),
        enabled: !!eventID,
        select: (data) => {
            const res = z.array(ParticipantSchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })

    const GetEventParticipantsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetEventParticipantsResponse, GetEventParticipantsRequest}
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
    return {CreateEventParticipant, CreateEventParticipantResponse, PendingCreateEventParticipant, CreateEventParticipantError}
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
    return {UpdateEventParticipantStatus, UpdateEventParticipantStatusResponse, PendingUpdateEventParticipantStatus, UpdateEventParticipantStatusError}
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
    return {UpdateEventParticipantTeam, UpdateEventParticipantTeamResponse, PendingUpdateEventParticipantTeam, UpdateEventParticipantTeamError}
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
    return {DeleteEventParticipant, DeleteEventParticipantResponse, PendingDeleteEventParticipant, DeleteEventParticipantError}
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
