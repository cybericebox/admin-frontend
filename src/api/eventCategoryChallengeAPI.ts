import type {IEventChallengeCategory, IOrder} from "@/types/challenge";
import type {AxiosResponse} from "axios";
import {baseAPI} from "@/api/baseAPI";
import type {IResponse} from "@/types/api";

export const getEventChallengeCategoriesFn = async (eventID: string): Promise<AxiosResponse<IResponse<IEventChallengeCategory[]>, any>> => {
    return await baseAPI.get(`/events/${eventID}/challenges/categories`);
}

export const createEventChallengeCategoryFn = async (eventID: string, category: IEventChallengeCategory): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post(`/events/${eventID}/challenges/categories`, category);
}

export const updateEventChallengeCategoryFn = async (category: IEventChallengeCategory): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.put(`/events/${category.EventID}/challenges/categories/${category.ID}`, category);
}

export const deleteEventChallengeCategoryFn = async (eventID: string, categoryID: string): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/events/${eventID}/challenges/categories/${categoryID}`);
}

export const updateEventChallengeCategoriesOrderFn = async (eventID: string, data: IOrder[]): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/events/${eventID}/challenges/categories/order`, data);
}