"use client"
import {useQuery} from "@tanstack/react-query";
import {getEventTeamsFn} from "@/api/eventTeamAPI";

const useGetEventTeams = (eventID: string) => {
    return useQuery({
        queryKey: ['eventTeams', eventID],
        queryFn: () => getEventTeamsFn(eventID),
    })
}

export const useEventTeam = () => {
    return {
        useGetEventTeams,
    }
};
