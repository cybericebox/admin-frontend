"use client";

import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import "moment/locale/uk";
import React from "react";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEventTeam} from "@/hooks/useEventTeam";
import {useEvent} from "@/hooks/useEvent";
import { ParticipationTypeEnum} from "@/types/event";
import toast from "react-hot-toast";
import {IErrorResponse} from "@/types/api";
import moment from "moment/moment";
import {useEventChallengeSolutionAttempt} from "@/hooks/useEventChallengeSolutionAttempt";
import {useUser} from "@/hooks/useUser";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {ErrorToast} from "@/components/common/errorToast";

interface EventChallengeSolutionAttemptsTableProps {
    eventID: string;
}

export default function EventChallengeSolutionAttemptsTable({eventID}: EventChallengeSolutionAttemptsTableProps) {
    const {GetEventChallengeSolutionAttemptsResponse, GetEventChallengeSolutionAttemptsRequest} = useEventChallengeSolutionAttempt().useGetEventChallengeSolutionAttempts(eventID);
    const {GetEventTeamsResponse} = useEventTeam().useGetEventTeams(eventID);
    const {GetUsersResponse} = useUser().useGetUsers({})
    const {GetEventChallengesResponse} = useEventChallenge().useGetEventChallenges(eventID)
    const {GetEventResponse} = useEvent().useGetEvent(eventID);
    const {UpdateEventChallengeSolutionAttemptStatus} = useEventChallengeSolutionAttempt().useUpdateEventChallengeSolutionAttemptStatus();
    return (
        <>
            <BodyHeader
                title={"Спроби вирішення завдань"}/>
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow>
                            <TableHead>{"Дата"}</TableHead>
                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team && <TableHead>{"Команда"}</TableHead>}
                            <TableHead>{"Учасник"}</TableHead>
                            <TableHead>{"Завдання"}</TableHead>
                            <TableHead className={"text-center"}>{"Статус"}</TableHead>
                            <TableHead>{"Прапор"}</TableHead>
                            <TableHead>{"Відповідь"}</TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        GetEventChallengeSolutionAttemptsResponse?.Data &&
                        <TableBody className={styles.tableBody}>
                            {
                                GetEventChallengeSolutionAttemptsResponse?.Data.map((solution) => {
                                    const team = GetEventTeamsResponse?.Data.find(team => team.ID === solution.TeamID)
                                    const participant = GetUsersResponse?.Data.find(user => user.ID === solution.ParticipantID)
                                    const challenge = GetEventChallengesResponse?.Data.find(challenge => challenge.ID === solution.ChallengeID)
                                    return (
                                        <TableRow key={solution.ID}>
                                            <TableCell>{moment(solution.Timestamp).format("DD.MM.YYYY HH:mm:ss")}</TableCell>
                                            <TableCell>
                                                {team?.Name || ""}
                                            </TableCell>
                                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team && <TableCell>
                                                {participant?.Name || ""}
                                            </TableCell>}
                                            <TableCell>
                                                {challenge?.Data.Name || ""}
                                            </TableCell>
                                            <TableCell className={"text-center"}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger>
                                                        <div
                                                            className={`border rounded-2xl text-center font-bold text-md py-1 w-24 ${solution.IsCorrect ? "border-green-500 text-green-700 bg-green-300" : "border-red-500 text-red-700 bg-red-300"}`}
                                                            data-tooltip-content={"Змінити статус спроби"}
                                                            data-tooltip-id="tooltip"
                                                        >
                                                            {solution.IsCorrect ? "Успіх" : "Невдача"}
                                                        </div>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem
                                                            onClick={() => UpdateEventChallengeSolutionAttemptStatus({
                                                                ...solution,
                                                                IsCorrect: !solution.IsCorrect
                                                            }, {
                                                                onSuccess: () => {
                                                                    toast.success("Статус спроби успішно змінено")
                                                                },
                                                                onError: (error) => {
                                                                    const e = error as IErrorResponse
                                                                    ErrorToast({
                                                                        message: "Не вдалося змінити статус спроби",
                                                                        error: e
                                                                    })
                                                                }
                                                            })}
                                                            className={`border rounded-2xl text-center py-1 ${solution.IsCorrect ? "border-red-500 text-red-700 bg-red-300" : "border-green-500 text-green-700 bg-green-300"}`}
                                                        >
                                                            {solution.IsCorrect ? "Відмітити як невдачу" : "Відмітити як успіх"}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                            <TableCell>
                                                {solution.Flag}
                                            </TableCell>
                                            <TableCell>
                                                {solution.Answer}
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
                        GetEventChallengeSolutionAttemptsRequest.isLoading ?
                            "Завантаження..." :
                            GetEventChallengeSolutionAttemptsRequest.isError ?
                                "Помилка завантаження" :
                                GetEventChallengeSolutionAttemptsRequest.isSuccess && GetEventChallengeSolutionAttemptsResponse?.Data.length === 0 ?
                                    "Жодного спроби вирішення завдань не знайдено" :
                                    null
                    }
                </div>
            </BodyContent>
        </>
    );
}