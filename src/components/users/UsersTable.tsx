"use client";
import {IUser, UserRoleEnum} from "@/types/user";
import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import moment from "moment";
import "moment/locale/uk";
import React, {useState} from "react";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {useUser} from "@/hooks/useUser";
import {ClientAuthentication} from "@/hooks/auth";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import toast from "react-hot-toast";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";

interface UsersTableProps {
    search: string
}

export default function UsersTable({search}: UsersTableProps) {
    const currentUser = ClientAuthentication();
    const {GetUsersResponse, GetUsersRequest} = useUser().useGetUsers({search});
    const {UpdateUserRole} = useUser().useUpdateUserRole();
    const {DeleteUser} = useUser().useDeleteUser();

    const [useDeleteDialog, setUseDeleteDialog] = useState<IUser>()

    return (
        <>
                <Table>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow className={"hover:bg-transparent"}>
                            <TableHead>Імʼя</TableHead>
                            <TableHead>Адреса електронної пошти</TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead>Остання активність</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        GetUsersResponse?.Data &&
                        <TableBody>
                            {
                                GetUsersResponse.Data?.map((user) => {
                                    return (
                                        <TableRow key={user.ID}
                                                  className={`${currentUser.ID === user.ID && "bg-blue-100"}`}>
                                            <TableCell>{user.Name}</TableCell>
                                            <TableCell>{user.Email}</TableCell>
                                            <TableCell className={styles.editButton}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            data-tooltip-id={"tooltip"}
                                                            data-tooltip-content={"Змінити роль користувача"}
                                                            data-tooltip-hidden={currentUser.ID === user.ID }
                                                            disabled={currentUser.ID === user.ID}
                                                        >
                                                            {user.Role}
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem
                                                                onClick={() => UpdateUserRole({
                                                                    ...user,
                                                                    Role: user.Role === UserRoleEnum.User ? UserRoleEnum.Administrator : UserRoleEnum.User
                                                                }, {
                                                                    onSuccess: () => {
                                                                        toast.success("Роль користувача успішно змінено")
                                                                    },
                                                                    onError: (error) => {
                                                                        const e = error as IErrorResponse
                                                                        ErrorToast({
                                                                            message: "Не вдалося змінити роль користувача",
                                                                            error: e
                                                                        })
                                                                    }
                                                                })}
                                                            >
                                                                {user.Role === UserRoleEnum.User ? "Зробити адміністратором" : "Зробити користувачем"}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                            </TableCell>
                                            <TableCell>
                                                {currentUser.ID != user.ID && moment(user.LastSeen).fromNow()}</TableCell>
                                            <TableCell>
                                                {currentUser.ID != user.ID &&
                                                    <DeleteIcon
                                                        title={"Видалити користувача"}
                                                        onClick={() => setUseDeleteDialog(user)}
                                                    />
                                                }
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            }
                        </TableBody>
                    }
                    <div
                        className={styles.emptyTableBody}
                    >
                        {
                            GetUsersRequest.isLoading ?
                                "Завантаження..." :
                                GetUsersRequest.isError ?
                                    "Помилка завантаження" :
                                    GetUsersRequest.isSuccess && GetUsersResponse?.Data.length === 0 && search.length != 0 ?
                                        "Користувачів за запитом не знайдено" :
                                        GetUsersRequest.isSuccess && GetUsersResponse?.Data.length === 0 && search.length === 0 ?
                                            "Жодного користувача не зареєстровано" :
                                            null
                        }
                    </div>
                </Table>
                {!!useDeleteDialog &&
                    <DeleteDialog
                        isOpen={!!useDeleteDialog}
                        onClose={() => setUseDeleteDialog(undefined)}
                        name={useDeleteDialog.Name}
                        description={"Впевнені? Всі дані користувача будуть втрачені та не можуть бути відновлені."}
                        onDelete={() => {
                            DeleteUser(useDeleteDialog.ID, {
                                onSuccess: () => {
                                    toast.success("Користувач успішно видалений")
                                },
                                onError: (error) => {
                                    const e = error as IErrorResponse
                                    ErrorToast({message: "Не вдалося видалити користувача", error: e})
                                }
                            })
                        }}
                    />
                }
        </>
    );
}