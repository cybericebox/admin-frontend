"use client";

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import "moment/locale/uk";
import React from "react";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEvent} from "@/hooks/useEvent";
import {ParticipationTypeEnum} from "@/types/event";
import moment from "moment/moment";
import {useEventChallengeSolutionAttempt} from "@/hooks/useEventChallengeSolutionAttempt";
import {useEventChallenge} from "@/hooks/useEventChallenge";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";
import {useInView} from "@/hooks/useInView";
import {useEventChallengeCategory} from "@/hooks/useEventChallengeCategory";

interface EventChallengeSolutionAttemptsTableProps {
    eventID: string;
}

export default function EventChallengeSolutionAttemptsTable({eventID}: EventChallengeSolutionAttemptsTableProps) {
    const {
        GetEventChallengeSolutionAttemptsResponse,
        GetEventChallengeSolutionAttemptsRequest,
        GetMoreEventChallengeSolutionAttemptsRequest
    } = useEventChallengeSolutionAttempt().useGetEventChallengeSolutionAttempts(eventID);
    const {GetEventChallengesResponse} = useEventChallenge().useGetEventChallenges(eventID)
    const {GetEventChallengeCategoriesResponse} = useEventChallengeCategory().useGetEventChallengeCategories(eventID)
    const {GetEventResponse} = useEvent().useGetEvent(eventID);
    const {UpdateEventChallengeSolutionAttemptStatus} = useEventChallengeSolutionAttempt().useUpdateEventChallengeSolutionAttemptStatus();

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetMoreEventChallengeSolutionAttemptsRequest.HasMore) {
                GetMoreEventChallengeSolutionAttemptsRequest.FetchMore()
            }
        },
        isLoading: GetEventChallengeSolutionAttemptsRequest.isLoading || GetMoreEventChallengeSolutionAttemptsRequest.isFetchingMore,
    });

    return (
        <>
            <BodyHeader
                title={"Спроби вирішення завдань"}/>
            <BodyContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{"Дата"}</TableHead>
                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team &&
                                <TableHead>{"Команда"}</TableHead>}
                            <TableHead>{"Учасник"}</TableHead>
                            <TableHead>{"Категорія"}</TableHead>
                            <TableHead>{"Завдання"}</TableHead>
                            <TableHead className={"text-center"}>{"Статус"}</TableHead>
                            <TableHead>{"Прапор"}</TableHead>
                            <TableHead>{"Відповідь"}</TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        <TableBody
                            onEmpty={{
                                isLoading: GetEventChallengeSolutionAttemptsRequest.isLoading,
                                error: GetEventChallengeSolutionAttemptsRequest.error,
                                isEmpty: !GetEventChallengeSolutionAttemptsResponse?.Data.length,
                                noDataMessage: "Жодної спроби вирішення завдань не зафіксовано",
                            }}
                            isFetchingMoreData={GetMoreEventChallengeSolutionAttemptsRequest.isFetchingMore}
                        >
                            {
                                GetEventChallengeSolutionAttemptsResponse?.Data.map((solution, index) => {
                                    const challenge = GetEventChallengesResponse?.Data.find((challenge) => challenge.ID === solution.ChallengeID)
                                    const category = GetEventChallengeCategoriesResponse?.Data.find((category) => challenge?.CategoryID === category.ID)
                                    return (
                                        <TableRow
                                            key={solution.ID}
                                            ref={GetEventChallengeSolutionAttemptsResponse.Data.length === index + 1 ? lastElementRef : null}
                                            className={`${solution.TeamID === GetEventResponse?.Data.ID && "bg-blue-100"}`}
                                        >
                                            <TableCell>{moment(solution.Timestamp).format("DD.MM.YYYY HH:mm:ss")}</TableCell>
                                            <TableCell>
                                                {solution.TeamName || ""}
                                            </TableCell>
                                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team &&
                                                <TableCell>
                                                    {solution.ParticipantName || ""}
                                                </TableCell>}
                                            <TableCell>
                                                {category?.Name || ""}
                                            </TableCell>
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
                                                                    SuccessToast("Статус спроби успішно змінено")
                                                                },
                                                                onError: (error) => {
                                                                    ErrorToast("Не вдалося змінити статус спроби", {cause: error})
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
            </BodyContent>
        </>
    );
}