import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";

import {
    createEventChallengeFn,
    deleteEventChallengeFn,
    getEventChallengesFn,
    UpdateEventChallengeData,
    UpdateEventChallengesOrderData,
    updateEventChallengesOrderFn
} from "@/api/eventChallengeAPI";
import {Challenge} from "@/types/challenge";

const useGetEventChallenges = (eventID: string, categoryID?: string) => {
    return useQuery({
        queryKey: ['challenges', eventID],
        queryFn: () => getEventChallengesFn(eventID),
        enabled: !!eventID,
        select: (data) => {
            if (categoryID) {
                return data?.filter((challenge) => challenge.CategoryID === categoryID)
            }
            return data
        }
    })
}

const useCreateEventChallenge = (eventID: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ['createEventChallenge'],
        mutationFn: (data: UpdateEventChallengeData) => createEventChallengeFn(eventID, data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['challenges', eventID]})
        }
    })
}

const useDeleteEventChallenge = (eventID: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ['deleteEventChallenge'],
        mutationFn: (challengeID: string) => deleteEventChallengeFn(eventID, challengeID),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['challenges', eventID]})
        }
    })
}

const useUpdateEventChallengesOrder = (eventID: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ['updateEventChallengesOrder'],
        mutationFn: (data: UpdateEventChallengesOrderData) => updateEventChallengesOrderFn(eventID, data),
        onMutate: async (variables) => {
            await queryClient.cancelQueries({queryKey: ['challenges', eventID]}).catch((e: any) => console.log(e))
            queryClient.setQueryData(['challenges', eventID], (old: Challenge[]) => [...old].sort((a, b) => a.Order - b.Order))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['challenges', eventID]})
        }
    })

}

export const useEventChallenge = () => {
    return {
        useGetEventChallenges,
        useCreateEventChallenge,
        useDeleteEventChallenge,
        useUpdateEventChallengesOrder,
    }
};
