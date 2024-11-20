import {useInfiniteQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {IInviteUsers, IUser, UserSchema} from "@/types/user";
import {deleteUserFn, getUsersFn, inviteUsersFn, updateUserRoleFn} from "@/api/userAPI";
import {z} from "zod";
import {ErrorInvalidResponseData} from "@/types/common";

const useGetUsers = ({search}: { search: string }) => {
    const {
        data: GetUsersResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        fetchNextPage: FetchMore,
        hasNextPage: HasMore,
        isFetchingNextPage: isFetchingMore,
    } = useInfiniteQuery({
        queryKey: ['users', search],
        queryFn: ({pageParam}) => getUsersFn({page: pageParam, search}),
        select: (data) => {
            data.pages.forEach((page) => {
                const res = z.array(UserSchema).safeParse(page.data.Data)
                if (!res.success) {
                    console.log(res.error)
                    throw ErrorInvalidResponseData
                } else {
                    page.data.Data = res.data
                }
            })

            return {
                Status: data.pages[data.pages.length - 1]?.data?.Status,
                Data: data.pages.map((page) => page.data.Data).flat()
            }
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            if (!lastPage?.data?.Data?.length) {
                return undefined
            }

            return lastPageParam + 1
        },
    })

    const GetUsersRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    const GetMoreUsersRequest = {
        FetchMore,
        HasMore,
        isFetchingMore,
    }

    return {GetUsersResponse, GetUsersRequest, GetMoreUsersRequest}
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