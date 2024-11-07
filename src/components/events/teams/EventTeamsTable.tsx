"use client";

import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import "moment/locale/uk";
import React from "react";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEventTeam} from "@/hooks/useEventTeam";
import {useEvent} from "@/hooks/useEvent";
import {ParticipationTypeEnum} from "@/types/event";

interface EventTeamsTableProps {
    eventID: string;
}

export default function EventTeamsTable({eventID}: EventTeamsTableProps) {
    const {GetEventTeamsResponse, GetEventTeamsRequest} = useEventTeam().useGetEventTeams(eventID);
    const {GetEventResponse} = useEvent().useGetEvent(eventID);

    return (
        <>
            <BodyHeader
                title={GetEventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Учасники заходу" : "Команди заходу"}/>
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow>
                            <TableHead>{GetEventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Імʼя" : "Назва"}</TableHead>
                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team && <TableHead className={"text-center"}>Кількість учасників</TableHead>}
                            <TableHead className={"text-center"}>Рейтинг</TableHead>
                            <TableHead className={"text-center"}>Бали</TableHead>
                            <TableHead className={"text-center"}>Кількість вирішених завдань</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        GetEventTeamsResponse?.Data &&
                        <TableBody className={styles.tableBody}>
                            {
                                GetEventTeamsResponse?.Data.map((team) => {
                                    return (
                                        <TableRow key={team.ID}>
                                            <TableCell>
                                                {team.Name}
                                            </TableCell>
                                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team && <TableCell className={"text-center"}>
                                                {team.ParticipantsCount}
                                            </TableCell>}
                                            <TableCell className={"text-center"}>
                                                {team.Rank || "-"}
                                            </TableCell>
                                            <TableCell className={"text-center"}>
                                                {team.Score || "-"}
                                            </TableCell>
                                            <TableCell className={"text-center"}>
                                                {team.SolvedChallengesCount || "-"}
                                            </TableCell>
                                            <TableCell>

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
                        GetEventTeamsRequest.isLoading ?
                            "Завантаження..." :
                            GetEventTeamsRequest.isError ?
                                "Помилка завантаження" :
                                GetEventTeamsRequest.isSuccess && GetEventTeamsResponse?.Data.length === 0 ?
                                    "Жодної команди не зареєстровано" :
                                    null
                    }
                </div>
            </BodyContent>
            {/*{!!eventTeamDeleteDialog &&*/}
            {/*    <DeleteDialog*/}
            {/*        isOpen={!!eventTeamDeleteDialog}*/}
            {/*        onClose={() => setEventTeamDeleteDialog(undefined)}*/}
            {/*        name={eventTeamDeleteDialog.Name}*/}
            {/*        description={"Впевнені? Всі дані команди включаючи завдання та рішення будуть втрачені та не можуть бути відновлені."}*/}
            {/*        onDelete={*/}
            {/*            () => {*/}
            {/*                DeleteEventTeam(eventTeamDeleteDialog.ID!, {*/}
            {/*                    onSuccess: () => {*/}
            {/*                        toast.success("Команда успішно видалена")*/}
            {/*                    },*/}
            {/*                    onError: (error) => {*/}
            {/*                        const e = error as IErrorResponse*/}
            {/*                        const message = e?.response?.data.Status.Message || ""*/}
            {/*                        toast.error(`Помилка видалення команди\n${message}`)*/}
            {/*                    },*/}
            {/*                })*/}
            {/*            }*/}
            {/*        }*/}
            {/*    />*/}
            {/*}*/}
        </>
    );
}