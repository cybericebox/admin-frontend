import {baseAPI} from "@/api/baseAPI";
import type {AxiosResponse} from "axios";
import type {IResponse} from "@/types/api";

export const signOut = async (): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post('/auth/sign-out')
}