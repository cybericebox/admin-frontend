import type {IParticipant} from "@/types/event";
import type {AxiosResponse} from "axios";
import type {IResponse} from "@/types/api";
import {baseAPI} from "@/api/baseAPI";

export const getEventParticipantsFn = async (eventID: string): Promise<AxiosResponse<IResponse<IParticipant[]>, any>> => {
    return await baseAPI.get(`/events/${eventID}/participants`);
}

export const createEventParticipantFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post(`/events/${participant.EventID}/participants`, {
        UserID: participant.UserID,
        ApprovalStatus: participant.ApprovalStatus
    });
}

export const updateEventParticipantStatusFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/events/${participant.EventID}/participants/${participant.UserID}/status`, {
        ApprovalStatus: participant.ApprovalStatus
    })
}

export const updateEventParticipantTeamFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/events/${participant.EventID}/participants/${participant.UserID}/team`, {
        TeamID: participant.TeamID
    })
}


export const deleteEventParticipantFn = async (participant: IParticipant): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/events/${participant.EventID}/participants/${participant.UserID}`);
}

