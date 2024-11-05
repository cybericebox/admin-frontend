import type {ITeamInfo} from "@/types/event";
import type {AxiosResponse} from "axios";
import type {IResponse} from "@/types/api";
import {baseAPI} from "@/api/baseAPI";

export const getEventTeamsFn = async (eventID: string): Promise<AxiosResponse<IResponse<ITeamInfo[]>, any>> => {
    return await baseAPI.get(`/events/${eventID}/teams/info`);
}



