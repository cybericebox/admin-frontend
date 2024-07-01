import {User} from "@/types/user";

export interface GetUsersData {
    search: string;
}


export const getUsersFn = async (search: string): Promise<User[]> => {
    return fetch(`/api/users?${search && "&search=" + search}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-cache'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get users", {
                cause: res
            })
        }
    })
}


export const updateUserRoleFn = async (user: User) => {
    return fetch(`/api/users/${user.ID}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({"role": user.Role})
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to update user role", {
                cause: res
            })
        }
    })
}

export const deleteUserFn = async (id: string) => {
    return fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to delete user", {
                cause: res
            })
        }
    })
}