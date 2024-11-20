"use client";

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import moment from "moment";
import "moment/locale/uk";
import React, {useState} from "react";
import {useEvent} from "@/hooks/useEvent";
import {EventTypeEnum, IEvent} from "@/types/event";
import Link from "next/link";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";
import {useInView} from "@/hooks/useInView";

export default function EventsTable() {
    const {GetEventsRequest, GetEventsResponse, GetMoreEventsRequest} = useEvent().useGetEvents();
    const {DeleteEvent} = useEvent().useDeleteEvent();
    const [eventDeleteDialog, setEventDeleteDialog] = useState<IEvent>()

    const getStatus = (event: IEvent) => {
        let dateTIme = new Date()
        if (new Date(event.WithdrawTime) < dateTIme) {
            return "Архівований"
        }
        if (new Date(event.FinishTime) < dateTIme) {
            return "Завершений"
        }
        if (new Date(event.StartTime) < dateTIme) {
            return "Активний"
        }
        if (new Date(event.PublishTime) < dateTIme) {
            return "Опублікований"
        }
        return "Створений"
    }

    const getStatusColor = (event: IEvent) => {
        let dateTIme = new Date();
        if (new Date(event.WithdrawTime) < dateTIme) {
            return "red";
        }
        if (new Date(event.FinishTime) < dateTIme) {
            return "gray";
        }
        if (new Date(event.StartTime) < dateTIme) {
            return "green";
        }
        if (new Date(event.PublishTime) < dateTIme) {
            return "blue";
        }
        return "black"
    }

    const getNextStep = (event: IEvent) => {
        let dateTIme = new Date()
        if (new Date(event.WithdrawTime) < dateTIme) {
            return ""
        }
        if (new Date(event.FinishTime) < dateTIme) {
            return `Архівація ${moment(event.WithdrawTime).fromNow()}`
        }
        if (new Date(event.StartTime) < dateTIme) {
            return `Завершення ${moment(event.FinishTime).fromNow()}`
        }
        if (new Date(event.PublishTime) < dateTIme) {
            return `Початок ${moment(event.StartTime).fromNow()}`
        }
        return `Публікація ${moment(event.PublishTime).fromNow()}`
    }

    const {ref: lastElementRef} = useInView({
        onInView: () => {
            if (GetMoreEventsRequest.HasMore) {
                GetMoreEventsRequest.FetchMore()
            }
        },
        isLoading: GetEventsRequest.isLoading || GetMoreEventsRequest.isFetchingMore,
    });

    return (
        <>
            <BodyHeader title={"Заходи"}/>
            <BodyContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Назва</TableHead>
                            <TableHead>Посилання</TableHead>
                            <TableHead>Тип заходу</TableHead>
                            <TableHead>Тип участі</TableHead>
                            <TableHead className={"text-center"}>Завдання</TableHead>
                            <TableHead className={"text-center"}>Учасники / Команди</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Наступний етап</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        GetEventsResponse?.Data &&
                        <TableBody
                            onEmpty={{
                                isLoading: GetEventsRequest.isLoading,
                                error: GetEventsRequest.error,
                                isEmpty: !GetEventsResponse?.Data.length,
                                noDataMessage: "Жодного заходу не створено",
                            }}
                            isFetchingMoreData={GetMoreEventsRequest.isFetchingMore}
                        >
                            {
                                GetEventsResponse?.Data.map((event, index) => {
                                    return (
                                        <TableRow
                                            ref={GetEventsResponse.Data.length === index + 1 ? lastElementRef : null}
                                            key={event.ID}
                                        >
                                            <TableCell>
                                                <Link
                                                    href={"/events/" + event.ID}
                                                    color="#54616e"
                                                    aria-label={"Event settings"}
                                                    data-tooltip-content="Перейти до налаштувань заходу"
                                                    data-tooltip-id="tooltip"
                                                >
                                                    {event.Name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={"https://" + event.Tag + "." + process.env.NEXT_PUBLIC_DOMAIN}
                                                    target="_blank"
                                                    color="#54616e"
                                                    aria-label={"Event site"}
                                                    data-tooltip-content="Перейти до заходу"
                                                    data-tooltip-id="tooltip"
                                                >
                                                    {"https://" + event.Tag + "." + process.env.NEXT_PUBLIC_DOMAIN}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {event.Type === EventTypeEnum.Competition && "Змагання"}
                                                {event.Type === EventTypeEnum.Practice && "Тренування"}
                                            </TableCell>
                                            <TableCell>
                                                {event.Participation === 0 && "Індивідуальний"}
                                                {event.Participation === 1 && "Командний"}
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/events/${event.ID}/challenges`}
                                                    color="#54616e"
                                                    aria-label="Event challenges"
                                                    data-tooltip-content="Перейти до завдань заходу"

                                                    data-tooltip-id="tooltip"
                                                >
                                                    <div className={"text-center"}>
                                                        {event.ChallengesCount}
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/events/${event.ID}/teams`}
                                                    color="#54616e"
                                                    aria-label="Event teams"
                                                    data-tooltip-content={`Перейти до ${event.Participation === 0 ? "учасників" : "команд"} заходу`}

                                                    data-tooltip-id="tooltip"
                                                >
                                                    <div className={"text-center"}>
                                                        {event.TeamsCount}
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <span style={{color: getStatusColor(event)}}>{getStatus(event)}</span>
                                            </TableCell>

                                            <TableCell>
                                                {getNextStep(event)}
                                            </TableCell>
                                            <TableCell>
                                                <DeleteIcon title={"Видалити захід"}
                                                            onClick={() => setEventDeleteDialog(event)}/>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            }
                        </TableBody>
                    }
                </Table>
            </BodyContent>
            {!!eventDeleteDialog &&
                <DeleteDialog
                    isOpen={!!eventDeleteDialog}
                    onClose={() => setEventDeleteDialog(undefined)}
                    name={eventDeleteDialog.Name}
                    description={"Впевнені? Всі дані заходу включаючи завдання та учасники будуть втрачені та не можуть бути відновлені."}
                    onDelete={
                        () => {
                            DeleteEvent(eventDeleteDialog.ID!, {
                                onSuccess: () => {
                                    SuccessToast("Захід успішно видалено")
                                },
                                onError: (error) => {
                                    ErrorToast("Не вдалося видалити захід", {cause: error})
                                },
                            })
                        }
                    }
                />
            }
        </>
    );
}