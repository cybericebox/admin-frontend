"use client";

import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import moment from "moment";
import "moment/locale/uk";
import React, {useState} from "react";
import {AuthenticatedClient} from "@/hooks/auth";
import {useEvent} from "@/hooks/useEvent";
import {Event, EventType} from "@/types/event";
import Link from "next/link";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {DeleteDialog, DeleteIcon} from "@/components/common/delete";

export default function EventsTable({domain}: { domain: string }) {
    const currentUser = AuthenticatedClient();

    const getEvents = useEvent().useGetEvents();
    const deleteEvent = useEvent().useDeleteEvent();
    const [eventToDelete, setEventToDelete] = useState<Event>()
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)

    const openDeleteDialog = (event: Event) => {
        setEventToDelete(event)
        setDeleteDialogOpen(true)
    }

    const getStatus = (event: Event) => {
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

    const getStatusColor = (event: Event) => {
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

    const getNextStep = (event: Event) => {
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

    return (
        <>
            <BodyHeader title={"Заходи"}/>
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
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
                        getEvents.data &&
                        <TableBody className={styles.tableBody}>
                            {
                                getEvents.data?.map((event) => {
                                    return (
                                        <TableRow key={event.ID}>
                                            <TableCell>
                                                <Link
                                                    href={"/events/" + event.Tag}
                                                    color="#54616e"
                                                    aria-label={"Event settings"}
                                                    data-tooltip-content="Перейти до налаштувань заходу"
                                                    data-tooltip-effect="solid"
                                                    data-tooltip-id="tooltip"
                                                >
                                                    {event.Name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={"https://" + event.Tag + "." + domain}
                                                    target="_blank"
                                                    color="#54616e"
                                                    aria-label={"Event site"}
                                                    data-tooltip-content="Перейти до заходу"
                                                    data-tooltip-effect="solid"
                                                    data-tooltip-id="tooltip"
                                                >
                                                    {"https://" + event.Tag + "." + domain}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {event.Type === EventType.Competition && "Змагання"}
                                                {event.Type === EventType.Practice && "Тренування"}
                                            </TableCell>
                                            <TableCell>
                                                {event.Participation === 0 && "Індивідуальний"}
                                                {event.Participation === 1 && "Командний"}
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/events/${event.Tag}/challenges`}
                                                    color="#54616e"
                                                    aria-label="Event challenges"
                                                    data-tooltip-content="Перейти до завдань заходу"
                                                    data-tooltip-effect="solid"
                                                    data-tooltip-id="tooltip"
                                                >
                                                    <div className={"text-center"}>
                                                        {event.ChallengesCount}
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/events/${event.Tag}/teams`}
                                                    color="#54616e"
                                                    aria-label="Event teams"
                                                    data-tooltip-content={`Перейти до ${event.Participation === 0 ? "учасників" : "команд"} заходу`}
                                                    data-tooltip-effect="solid"
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
                                                            onClick={() => openDeleteDialog(event)}/>
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
                        getEvents.isLoading ?
                            "Завантаження..." :
                            getEvents.isError ?
                                "Помилка завантаження" :
                                getEvents.isSuccess && getEvents.data.length === 0 ?
                                    "Жодного заходу не створено" :
                                    null
                    }
                </div>
            </BodyContent>
            {!!eventToDelete &&
                <DeleteDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    name={eventToDelete.Name}
                    description={"Впевнені? Всі дані заходу включаючи завдання та учасники будуть втрачені та не можуть бути відновлені."}
                    onDelete={
                        () => {
                            deleteEvent.mutate(eventToDelete?.ID!)
                        }
                    }
                />
            }
        </>
    );
}