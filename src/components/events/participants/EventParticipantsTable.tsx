"use client";

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import "moment/locale/uk";
import React, {useState} from "react";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEventTeam} from "@/hooks/useEventTeam";
import {useEvent} from "@/hooks/useEvent";
import {IParticipant, ParticipationStatusEnum, ParticipationStatusNameEnum, ParticipationTypeEnum} from "@/types/event";
import {useEventParticipant} from "@/hooks/useEventParticipant";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import moment from "moment/moment";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";
import {useInView} from "@/hooks/useInView";

interface EventParticipantsTableProps {
    eventID: string;
}

export default function EventParticipantsTable({eventID}: EventParticipantsTableProps) {
    const {
        GetEventParticipantsResponse,
        GetEventParticipantsRequest,
        GetModeEventParticipantsRequest
    } = useEventParticipant().useGetEventParticipants(eventID);
    const {GetEventTeamsResponse} = useEventTeam().useGetEventTeams(eventID)
    const {GetEventResponse} = useEvent().useGetEvent(eventID);

    const [eventParticipantDeleteDialog, setEventParticipantDeleteDialog] = useState<IParticipant>()
    const {DeleteEventParticipant} = useEventParticipant().useDeleteEventParticipant()
    const {UpdateEventParticipantStatus} = useEventParticipant().useUpdateEventParticipantStatus()

    const UpdateEventParticipantStatusFn = (participant: IParticipant) => {
        UpdateEventParticipantStatus(participant, {
            onSuccess: () => {
                SuccessToast("Статус учасника успішно змінено")
            },
            onError: (error) => {
                ErrorToast("Не вдалося змінити статус учасника", {cause: error})
            },
        })
    }

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetModeEventParticipantsRequest.HasMore) {
                GetModeEventParticipantsRequest.FetchMore()
            }
        },
        isLoading: GetEventParticipantsRequest.isLoading || GetModeEventParticipantsRequest.isFetchingMore,
    });

    return (
        <>
            <BodyHeader
                title={"Реєстрації учасників"}/>
            <BodyContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{"Імʼя"}</TableHead>
                            <TableHead>{"Адреса електронної пошти"}</TableHead>
                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team &&
                                <TableHead>{"Команда"}</TableHead>}
                            <TableHead className={"text-center"}>{"Статус реєстрації"}</TableHead>
                            <TableHead>{"Час реєстрації"}</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        <TableBody
                            onEmpty={{
                                isLoading: GetEventParticipantsRequest.isLoading,
                                error: GetEventParticipantsRequest.error,
                                isEmpty: !GetEventParticipantsResponse?.Data.length,
                                noDataMessage: "Жодного учасника не зареєстровано",
                            }}
                            isFetchingMoreData={GetModeEventParticipantsRequest.isFetchingMore}
                        >
                            {
                                GetEventParticipantsResponse?.Data.map((participant, index) => {
                                    const team = GetEventTeamsResponse?.Data.find(team => team.ID === participant.TeamID)
                                    return (
                                        <TableRow
                                            key={participant.UserID}
                                            ref={GetEventParticipantsResponse.Data.length === index + 1 ? lastElementRef : null}
                                        >
                                            <TableCell>
                                                {participant?.Name || ""}
                                            </TableCell>
                                            <TableCell>
                                                {participant?.Email || ""}
                                            </TableCell>
                                            {GetEventResponse?.Data.Participation === ParticipationTypeEnum.Team &&
                                                <TableCell>
                                                    {team?.Name || ""}
                                                </TableCell>}
                                            <TableCell className={"text-center"}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger>
                                                        <div
                                                            className={`border rounded-2xl text-center font-bold text-md py-1 w-52 ${ParticipationStatusEnum.ApprovedParticipationStatus === participant.ApprovalStatus ? "border-green-500 text-green-700 bg-green-300" : ParticipationStatusEnum.RejectedParticipationStatus === participant.ApprovalStatus ? "border-red-500 text-red-700 bg-red-300" : "border-yellow-500 text-yellow-700 bg-yellow-300"}`}
                                                            data-tooltip-content={"Змінити статус учасника"}
                                                            data-tooltip-id="tooltip"
                                                        >
                                                            {ParticipationStatusNameEnum[participant.ApprovalStatus]}
                                                        </div>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        className={"flex flex-col justify-around gap-2"}
                                                    >
                                                        {participant.ApprovalStatus != ParticipationStatusEnum.ApprovedParticipationStatus &&
                                                            <DropdownMenuItem
                                                                onClick={() => UpdateEventParticipantStatusFn(
                                                                    {
                                                                        ...participant,
                                                                        ApprovalStatus: ParticipationStatusEnum.ApprovedParticipationStatus
                                                                    }
                                                                )}
                                                                className={"border rounded-2xl py-1 w-52 border-green-500 text-green-700 bg-green-300 focus:bg-green-400 focus:text-green-700"}
                                                            >
                                                                {"Затвердити участь"}
                                                            </DropdownMenuItem>
                                                        }
                                                        {participant.ApprovalStatus != ParticipationStatusEnum.RejectedParticipationStatus &&
                                                            <DropdownMenuItem
                                                                onClick={() => UpdateEventParticipantStatusFn(
                                                                    {
                                                                        ...participant,
                                                                        ApprovalStatus: ParticipationStatusEnum.RejectedParticipationStatus
                                                                    }
                                                                )}
                                                                className={"border rounded-2xl py-1 w-52 border-red-500 text-red-700 bg-red-300 focus:bg-red-400 focus:text-red-700"}
                                                            >
                                                                {"Відхилити участь"}
                                                            </DropdownMenuItem>
                                                        }
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                            <TableCell>{moment(participant.CreatedAt).fromNow()}</TableCell>
                                            <TableCell>
                                                <DeleteIcon title={"Видалити учасника"}
                                                            onClick={() => setEventParticipantDeleteDialog(participant)}/>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            }
                        </TableBody>
                    }
                </Table>
            </BodyContent>
            {!!eventParticipantDeleteDialog &&
                <DeleteDialog
                    isOpen={!!eventParticipantDeleteDialog}
                    onClose={() => setEventParticipantDeleteDialog(undefined)}
                    name={eventParticipantDeleteDialog.Name}
                    description={"Впевнені? Всі дані учасника будуть втрачені та не можуть бути відновлені."}
                    onDelete={
                        () => {
                            DeleteEventParticipant(eventParticipantDeleteDialog, {
                                onSuccess: () => {
                                    SuccessToast("Учасника успішно видалено")
                                },
                                onError: (error) => {
                                    ErrorToast("Не вдалося видалити учасника", {cause: error})
                                },
                            })
                        }
                    }
                />
            }
        </>
    );
}