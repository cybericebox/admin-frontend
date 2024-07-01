import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {User} from "@/types/user";
import {deleteUserFn, GetUsersData, getUsersFn, updateUserRoleFn} from "@/api/userAPI";
import toast from "react-hot-toast";

const useGetUsers = ({search}: GetUsersData) => {
    return useQuery({
        queryKey: ['users', search],
        queryFn: () => getUsersFn(search),

    })
}


const useUpdateUserRole = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["updateUserRole"],
        mutationFn: (user: User) => updateUserRoleFn(user),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['users']}).then(() => {
                toast.success("Роль користувача успішно оновлено", {})
            }).catch((e) => console.log(e))
        },
    })
}

const useDeleteUser = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["deleteUser"],
        mutationFn: async (id: string) => await deleteUserFn(id),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['users']}).then(() => {
                toast.success("Користувача успішно видалено", {})
            }).catch((e) => console.log(e))
        }
    })
}


export const useUser = () => {
    return {
        useGetUsers,
        useUpdateUserRole,
        useDeleteUser,
    }
}