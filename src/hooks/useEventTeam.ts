"use client"
import {useInfiniteQuery} from "@tanstack/react-query";
import {getEventTeamsFn} from "@/api/eventTeamAPI";
import {z} from "zod";
import {TeamSchema} from "@/types/event";
import {ErrorInvalidResponseData} from "@/types/common";

const useGetEventTeams = (eventID: string) => {
    const {
        data: GetEventTeamsResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        fetchNextPage: FetchMore,
        hasNextPage: HasMore,
        isFetchingNextPage: isFetchingMore,
    } = useInfiniteQuery({
        queryKey: ['eventTeams', eventID],
        queryFn: ({pageParam}) => getEventTeamsFn({eventID, page: pageParam}),
        enabled: !!eventID,
        select: (data) => {
            data.pages.forEach((page) => {
                const res = z.array(TeamSchema).safeParse(page.data.Data)
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

    const GetEventTeamsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    const GetMoreEventTeamsRequest = {
        isFetchingMore,
        HasMore,
        FetchMore,
    }

    return {GetEventTeamsResponse, GetEventTeamsRequest, GetMoreEventTeamsRequest}
}

export const useEventTeam = () => {
    return {
        useGetEventTeams,
    }
};
