"use client";

import {User} from "@/types/user";
import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import moment from "moment";
import "moment/locale/uk";
import React, {useState} from "react";
import {Search} from "@/components/common";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {useUser} from "@/hooks/useUser";
import {MdEdit} from "react-icons/md";
import {AuthenticatedClient} from "@/hooks/auth";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";

export default function UsersTable() {
    const currentUser = AuthenticatedClient();
    const [search, setSearch] = useState("")

    const getUsers = useUser().useGetUsers({search});
    const updateUser = useUser().useUpdateUserRole();
    const deleteUser = useUser().useDeleteUser();

    const [userToDelete, setUserToDelete] = useState<User>()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)

    const openDeleteDialog = (user: User) => {
        setUserToDelete(user)
        setDeleteDialogOpen(true)
    }

    return (
        <>
            <BodyHeader title={"Користувачі"}>
                <Search setSearch={setSearch} placeholder={"Знайти користувача"} key={"search"}/>
            </BodyHeader>
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow>
                            <TableHead>Імʼя</TableHead>
                            <TableHead>Адреса електронної пошти</TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead>Остання активність</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        getUsers.data &&
                        <TableBody className={styles.tableBody}>
                            {
                                getUsers.data?.map((user: User) => {
                                    return (
                                        <TableRow key={user.ID}
                                                  className={`${currentUser.ID === user.ID && "bg-blue-100 hover:bg-blue-100"}`}>
                                            <TableCell>{user.Name}</TableCell>
                                            <TableCell>{user.Email}</TableCell>
                                            <TableCell className={styles.editButton}>
                                                {user.Role}
                                                {currentUser.ID != user.ID &&
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger>
                                                            <MdEdit
                                                                className={styles.editIcon}
                                                                aria-label="Change user role"
                                                                data-tooltip-content="Змінити роль користувача"
                                                                data-tooltip-effect="solid"
                                                                data-tooltip-id="tooltip"
                                                            />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem
                                                                onClick={() => updateUser.mutate({
                                                                    ...user,
                                                                    Role: user.Role === "Користувач" ? "Адміністратор" : "Користувач"
                                                                })}
                                                            >
                                                                {user.Role === "Користувач" ? "Зробити адміністратором" : "Зробити користувачем"}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>}
                                            </TableCell>
                                            <TableCell>
                                                {currentUser.ID != user.ID && moment(user.LastSeen).fromNow()}</TableCell>
                                            <TableCell>
                                                {currentUser.ID != user.ID &&
                                                    <DeleteIcon
                                                        title={"Видалити користувача"}
                                                        onClick={() => openDeleteDialog(user)}
                                                    />
                                                }
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            }
                        </TableBody>
                    }
                </Table>
                <div
                    className={styles.emptyTableBody}
                >
                    {
                        getUsers.isLoading ?
                            "Завантаження..." :
                            getUsers.isError ?
                                "Помилка завантаження" :
                                getUsers.isSuccess && getUsers.data.length === 0 && search.length != 0 ?
                                    "Жодного користувача не знайдено" :
                                    getUsers.isSuccess && getUsers.data.length === 0 && search.length === 0 ?
                                        "Жодного користувача не зареєстровано" :
                                        null
                    }
                </div>
                {userToDelete &&
                    <DeleteDialog
                        isOpen={isDeleteDialogOpen}
                        onClose={() => setDeleteDialogOpen(false)}
                        name={userToDelete.Name}
                        description={"Впевнені? Всі дані користувача будуть втрачені та не можуть бути відновлені."}
                        onDelete={() => {
                            deleteUser.mutate(userToDelete.ID)
                        }}
                    />
                }
            </BodyContent>
        </>
    );
}