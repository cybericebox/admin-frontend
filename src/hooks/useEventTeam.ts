"use client"
import {useQuery} from "@tanstack/react-query";
import {getEventTeamsFn} from "@/api/eventTeamAPI";
import {z} from "zod";
import {TeamInfoSchema} from "@/types/event";

const useGetEventTeams = (eventID: string) => {
    const {
        data: GetEventTeamsResponse,
        isLoading,
        isError,
        isSuccess,
        error
    } = useQuery({
        queryKey: ['eventTeams', eventID],
        queryFn: () => getEventTeamsFn(eventID),
        enabled: !!eventID,
        select: (data) => {
            const res = z.array(TeamInfoSchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })

    const GetEventTeamsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetEventTeamsResponse, GetEventTeamsRequest}
}

export const useEventTeam = () => {
    return {
        useGetEventTeams,
    }
};
