import type {IExerciseCategory} from "@/types/exercise";
import type {IResponse} from "@/types/api";
import {baseAPI} from "@/api/baseAPI";
import {AxiosResponse} from "axios";

export const getExerciseCategoriesFn = async (): Promise<AxiosResponse<IResponse<IExerciseCategory[]>, any>> => {
    return await baseAPI.get('/exercises/categories')
}

export const getExerciseCategoryFn = async (id: string): Promise<AxiosResponse<IResponse<IExerciseCategory>, any>> => {
    return await baseAPI.get(`/exercises/categories/${id}`)
}

export const createExerciseCategoryFn = async (data: IExerciseCategory): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post('/exercises/categories', data);
}

export const updateExerciseCategoryFn = async (category: IExerciseCategory): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.put(`/exercises/categories/${category.ID}`, category);
}

export const deleteExerciseCategoryFn = async (id: string): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/exercises/categories/${id}`);
}