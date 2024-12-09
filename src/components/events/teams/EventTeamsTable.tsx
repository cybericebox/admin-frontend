"use client";

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import "moment/locale/uk";
import React from "react";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEventTeam} from "@/hooks/useEventTeam";
import {useEvent} from "@/hooks/useEvent";
import {ParticipationTypeEnum} from "@/types/event";
import {useInView} from "@/hooks/useInView";

interface EventTeamsTableProps {
    eventID: string;
}

export default function EventTeamsTable({eventID}: EventTeamsTableProps) {
    const {
        GetEventTeamsResponse,
        GetEventTeamsRequest,
        GetMoreEventTeamsRequest
    } = useEventTeam().useGetEventTeams(eventID);
    const {GetEventResponse} = useEvent().useGetEvent(eventID);

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetMoreEventTeamsRequest.HasMore) {
                GetMoreEventTeamsRequest.FetchMore()
            }
        },
        isLoading: GetEventTeamsRequest.isLoading || GetMoreEventTeamsRequest.isFetchingMore,
    });

    return (
        <>
            <BodyHeader
                title={GetEventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Учасники заходу" : "Команди заходу"}/>
            <BodyContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{GetEventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Імʼя" : "Назва"}</TableHead>
                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team &&
                                <TableHead className={"text-center"}>Кількість учасників</TableHead>}
                            {/*<TableHead className={"text-center"}>Рейтинг</TableHead>*/}
                            {/*<TableHead className={"text-center"}>Бали</TableHead>*/}
                            {/*<TableHead className={"text-center"}>Кількість вирішених завдань</TableHead>*/}
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        <TableBody
                            onEmpty={{
                                isLoading: GetEventTeamsRequest.isLoading,
                                error: GetEventTeamsRequest.error,
                                isEmpty: !GetEventTeamsResponse?.Data.length,
                                noDataMessage: `${GetEventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Жодного учасника" : "Жодної команди"} не зареєстровано`,
                            }}
                            isFetchingMoreData={GetMoreEventTeamsRequest.isFetchingMore}
                        >
                            {
                                GetEventTeamsResponse?.Data.map((team, index) => {
                                    return (
                                        <TableRow
                                            key={team.ID}
                                            ref={GetEventTeamsResponse.Data.length === index + 1 ? lastElementRef : null}
                                            className={`${team.ID === GetEventResponse?.Data.ID && "bg-blue-100"}`}
                                        >
                                            <TableCell>
                                                {team.Name}
                                            </TableCell>
                                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team &&
                                                <TableCell className={"text-center"}>
                                                    {team.ID === GetEventResponse?.Data.ID ? "-" : team.ParticipantsCount}
                                                </TableCell>}
                                            {/*<TableCell className={"text-center"}>*/}
                                            {/*    {team.Rank || "-"}*/}
                                            {/*</TableCell>*/}
                                            {/*<TableCell className={"text-center"}>*/}
                                            {/*    {team.Score || "-"}*/}
                                            {/*</TableCell>*/}
                                            {/*<TableCell className={"text-center"}>*/}
                                            {/*    {team.SolvedChallengesCount || "-"}*/}
                                            {/*</TableCell>*/}
                                            <TableCell>

                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            }
                        </TableBody>
                    }
                </Table>
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