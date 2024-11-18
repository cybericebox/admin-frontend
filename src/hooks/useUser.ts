import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {IInviteUsers, IUser, UserSchema} from "@/types/user";
import {deleteUserFn, getUsersFn, inviteUsersFn, updateUserRoleFn} from "@/api/userAPI";
import {z} from "zod";
import {ErrorInvalidResponseData} from "@/types/common";

const useGetUsers = ({search}: { search?: string }) => {
    const {data: GetUsersResponse, isLoading, isError, isSuccess, error} = useQuery({
        queryKey: ['users', search],
        queryFn: () => getUsersFn(search),
        select: (data) => {
            const res = z.array(UserSchema).safeParse(data.data.Data)
            if (!res.success) {
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })

    const GetUsersRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetUsersResponse, GetUsersRequest}
}

const useInviteUsers = () => {
    const queryClient = useQueryClient()
    const {data: InviteUsersResponse, mutate: InviteUsers, isPending: PendingInviteUsers} = useMutation({
        mutationKey: ["inviteUsers"],
        mutationFn: async (data: IInviteUsers) => await inviteUsersFn(data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['users']}).catch((e) => console.log(e))
        }
    })
    return {InviteUsersResponse, InviteUsers, PendingInviteUsers}
}


const useUpdateUserRole = () => {
    const queryClient = useQueryClient()
    const {data: UpdateUserRoleResponse, mutate: UpdateUserRole, isPending: PendingUpdateUserRole} = useMutation({
        mutationKey: ["updateUserRole"],
        mutationFn: (user: IUser) => updateUserRoleFn(user),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['users']}).catch((e) => console.log(e))
        },
    })
    return {UpdateUserRoleResponse, UpdateUserRole, PendingUpdateUserRole}
}

const useDeleteUser = () => {
    const queryClient = useQueryClient()
    const {data: DeleteUserResponse, mutate: DeleteUser, isPending: PendingDeleteUser} = useMutation({
        mutationKey: ["deleteUser"],
        mutationFn: async (id: string) => await deleteUserFn(id),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['users']}).catch((e) => console.log(e))
        }
    })
    return {DeleteUserResponse, DeleteUser, PendingDeleteUser}
}


export const useUser = () => {
    return {
        useGetUsers,
        useInviteUsers,
        useUpdateUserRole,
        useDeleteUser,
    }
}