import type {ICreateEventChallenge, IEventChallenge, IOrder} from "@/types/challenge";
import type {AxiosResponse} from "axios";
import {baseAPI} from "@/api/baseAPI";
import type {IResponse} from "@/types/api";
import {IExercise} from "@/types/exercise";

export const getEventChallengesFn = async (eventID: string): Promise<AxiosResponse<IResponse<IEventChallenge[]>, any>> => {
    return await baseAPI.get(`/events/${eventID}/challenges`);
}

interface getAvailableExercisesParams {
    eventID: string
    search: string
    page: number
}

export const getAvailableExercisesFn = async ({
                                                  eventID,
                                                  search,
                                                  page
                                              }: getAvailableExercisesParams): Promise<AxiosResponse<IResponse<IExercise[]>, any>> => {
    return await baseAPI.get((`/events/${eventID}/challenges/exercises?page=${page}${search && "&search=" + search}`))
}

export const createEventChallengeFn = async (eventID: string, data: ICreateEventChallenge): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post(`/events/${eventID}/challenges`, data);
}

export const deleteEventChallengeFn = async (eventID: string, challengeID: string): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/events/${eventID}/challenges/${challengeID}`);
}

export const updateEventChallengesOrderFn = async (eventID: string, data: IOrder[]): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/events/${eventID}/challenges/order`, data);
}

