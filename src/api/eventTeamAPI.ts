import type {ITeam} from "@/types/event";
import type {AxiosResponse} from "axios";
import type {IResponse} from "@/types/api";
import {baseAPI} from "@/api/baseAPI";

interface getEventTeamsProps {
    eventID: string
    page: number
}

export const getEventTeamsFn = async ({
                                          eventID,
                                          page
                                      }: getEventTeamsProps): Promise<AxiosResponse<IResponse<ITeam[]>, any>> => {
    return await baseAPI.get(`/events/${eventID}/teams?page=${page}`);
}



