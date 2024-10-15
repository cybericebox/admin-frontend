import type {IExercise} from "@/types/exercise";
import {baseAPI} from "@/api/baseAPI";
import type {AxiosResponse} from "axios";
import {IDownloadFileURL, IUploadFileData} from "@/types/common";
import {IResponse} from "@/types/api";

export const getExercisesFn = async (search: string): Promise<AxiosResponse<IResponse<IExercise[]>, any>> => {
    return await baseAPI.get(`/exercises?${search && "search=" + search}`);
}

export const getExerciseFn = async (id: string): Promise<AxiosResponse<IResponse<IExercise>, any>> => {
    return await baseAPI.get(`/exercises/${id}`);
}

export const getUploadExerciseFileDataFn = async (): Promise<AxiosResponse<IResponse<IUploadFileData>, any>> => {
    return await baseAPI.get(`/exercises/upload/file`)
}

export const getDownloadExerciseFileDataFn = async (exerciseID: string, fileID: string, fileName: string): Promise<AxiosResponse<IResponse<IDownloadFileURL>, any>> => {
    return await baseAPI.get(`/exercises/${exerciseID}/download/file/${fileID}${fileName && "?fileName=" + fileName}`);
}

export const createExerciseFn = async (data: IExercise): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post('/exercises', data);
}

export const updateExerciseFn = async (exercise: IExercise): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.put(`/exercises/${exercise.ID}`, exercise);
}

export const deleteExerciseFn = async (id: string): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/exercises/${id}`);
}
