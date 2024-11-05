import type {AxiosResponse} from "axios";
import type {IResponse} from "@/types/api";
import {baseAPI} from "@/api/baseAPI";
import {type IEventChallengeSolutionAttempt} from "@/types/challenge";

export const getEventChallengeSolutionAttemptsFn = async (eventID: string): Promise<AxiosResponse<IResponse<IEventChallengeSolutionAttempt[]>, any>> => {
    return await baseAPI.get(`/events/${eventID}/challenges/solutions`);
}

export const updateEventChallengeSolutionAttemptStatusFn = async (attempt: IEventChallengeSolutionAttempt): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/events/${attempt.EventID}/challenges/solutions/${attempt.ID}/status`, attempt)
}


