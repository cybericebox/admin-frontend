import type {IEvent} from "@/types/event";
import type {AxiosResponse} from "axios";
import {baseAPI} from "@/api/baseAPI";
import {IUploadFileData} from "@/types/common";
import {IResponse} from "@/types/api";

export const getEventsFn = async (): Promise<AxiosResponse<IResponse<IEvent[]>, any>> => {
    return await baseAPI.get('/events')
}

export const getEventFn = async (id: string): Promise<AxiosResponse<IResponse<IEvent>, any>> => {
    return await baseAPI.get(`/events/${id}`)
}

export const getUploadEventBannerDataFn = async (): Promise<AxiosResponse<IResponse<IUploadFileData>, any>> => {
    return await baseAPI.get(`/events/upload/banner`)
}

export const getDownloadEventBannerDataFn = async (id: string): Promise<AxiosResponse<IResponse<string>, any>> => {
    return await baseAPI.get(`/events/${id}/download/banner`)
}

export const createEventFn = async (event: IEvent): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post('/events', event)
}

export const updateEventFn = async (event: IEvent): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.put(`/events/${event.ID}`, event)
}

export const deleteEventFn = async (id: string): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/events/${id}`);
}