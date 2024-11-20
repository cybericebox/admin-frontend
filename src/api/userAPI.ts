import type {IInviteUsers, IUser} from "@/types/user";
import type {IResponse} from "@/types/api";
import {baseAPI} from "@/api/baseAPI";
import type {AxiosResponse} from "axios";


interface getUsersProps {
    page: number
    search: string
}

export const getUsersFn = async ({page, search}: getUsersProps): Promise<AxiosResponse<IResponse<IUser[]>, any>> => {
    return await baseAPI.get(`/users?page=${page}&${search.length && "search=" + search}`)
}

export const inviteUsersFn = async (data: IInviteUsers): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post("/users/invite", {
        Emails: data.Emails.map((email) => email.Email),
        Role: data.Role
    })
}

export const updateUserRoleFn = async (user: IUser): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.patch(`/users/${user.ID}`, {
        Role: user.Role
    })
}

export const deleteUserFn = async (id: string): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.delete(`/users/${id}`)
}