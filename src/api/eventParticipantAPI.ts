import type {IParticipant} from "@/types/event";
import type {AxiosResponse} from "axios";
import type {IResponse} from "@/types/api";
import {baseAPI} from "@/api/baseAPI";

interface getEventParticipantsParams {
    eventID: string
    page: number
}

export const getEventParticipantsFn = async ({
                                                 eventID,
                                                 page
                                             }: getEventParticipantsParams): Promise<AxiosResponse<IResponse<IParticipant[]>, any>> => {
    return await baseAPI.get(`/events/${eventID}/participants?page=${page}`);
}

export const createEventParticipantFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post(`/events/${participant.EventID}/participants`, participant);
}

export const updateEventParticipantStatusFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/events/${participant.EventID}/participants/${participant.UserID}/status`, {
        ApprovalStatus: participant.ApprovalStatus
    })
}

export const updateEventParticipantTeamFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/events/${participant.EventID}/participants/${participant.UserID}/team`, participant)
}

export const deleteEventParticipantFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/events/${participant.EventID}/participants/${participant.UserID}`);
}

