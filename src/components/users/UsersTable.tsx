"use client";
import {type IUser, UserRoleEnum} from "@/types/user";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import moment from "moment";
import "moment/locale/uk";
import {useState} from "react";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {useUser} from "@/hooks/useUser";
import {ClientAuthentication} from "@/hooks/auth";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";
import {useInView} from "@/hooks/useInView";

interface UsersTableProps {
    search: string
}

export default function UsersTable({search}: UsersTableProps) {
    const currentUser = ClientAuthentication();
    const {GetUsersResponse, GetUsersRequest, GetMoreUsersRequest} = useUser().useGetUsers({search});
    const {UpdateUserRole} = useUser().useUpdateUserRole();
    const {DeleteUser} = useUser().useDeleteUser();

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetMoreUsersRequest.HasMore) {
                GetMoreUsersRequest.FetchMore()
            }
        },
        isLoading: GetUsersRequest.isLoading || GetMoreUsersRequest.isFetchingMore,
        deps: [search]
    });

    const [useDeleteDialog, setUseDeleteDialog] = useState<IUser>()

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Імʼя</TableHead>
                        <TableHead>Адреса електронної пошти</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead>Остання активність</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                {
                    <TableBody
                        onEmpty={{
                            isLoading: GetUsersRequest.isLoading,
                            error: GetUsersRequest.error,
                            hasFilter: search.length > 0,
                            isEmpty: !GetUsersResponse?.Data.length,
                            noDataMessage: "Жодного користувача не зареєстровано",
                            noFilteredDataMessage: "Користувачів за запитом не знайдено"
                        }}
                        isFetchingMoreData={GetMoreUsersRequest.isFetchingMore}
                    >
                        {
                            GetUsersResponse?.Data?.map((user, index) => {
                                return (
                                    <TableRow key={user.ID}
                                              ref={GetUsersResponse.Data.length === index + 1 ? lastElementRef : null}
                                              className={`${currentUser.ID === user.ID && "bg-blue-100"}`}>
                                        <TableCell>{user.Name}</TableCell>
                                        <TableCell>{user.Email}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger
                                                    data-tooltip-id={"tooltip"}
                                                    data-tooltip-content={"Змінити роль користувача"}
                                                    data-tooltip-hidden={currentUser.ID === user.ID}
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
                                                                SuccessToast("Роль користувача успішно змінено")
                                                            },
                                                            onError: (error) => {
                                                                ErrorToast("Не вдалося змінити роль користувача", {cause: error})
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
                                SuccessToast("Користувач успішно видалений")
                            },
                            onError: (error) => {
                                ErrorToast("Не вдалося видалити користувача", {cause: error})
                            }
                        })
                    }}
                />
            }
        </>
    );
}