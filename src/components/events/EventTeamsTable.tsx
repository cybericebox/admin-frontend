"use client";

import styles from "@/components/components.module.css";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import "moment/locale/uk";
import React from "react";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {useEventTeam} from "@/hooks/useEventTeam";
import {useEvent} from "@/hooks/useEvent";
import {ParticipationType} from "@/types/event";

interface EventTeamsTableProps {
    eventTag: string;
}

export default function EventTeamsTable({eventTag}: EventTeamsTableProps) {
    const eventTeams = useEventTeam().useGetEventTeams(eventTag);
    const event = useEvent().useGetEventByTag(eventTag);

    return (
        <>
            <BodyHeader
                title={event.data?.Participation === ParticipationType.Individual ? "Учасники заходу" : "Команди заходу"}/>
            <BodyContent>
                <Table className={styles.table}>
                    <TableHeader className={styles.tableHeader}>
                        <TableRow>
                            <TableHead>{event.data?.Participation === ParticipationType.Individual ? "Імʼя" : "Назва"}</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    {
                        eventTeams.data &&
                        <TableBody className={styles.tableBody}>
                            {
                                eventTeams.data?.map((team) => {
                                    return (
                                        <TableRow key={team.ID}>
                                            <TableCell>
                                                {team.Name}
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
                        eventTeams.isLoading ?
                            "Завантаження..." :
                            eventTeams.isError ?
                                "Помилка завантаження" :
                                eventTeams.isSuccess && eventTeams.data.length === 0 ?
                                    "Жодної команди не зареєстровано" :
                                    null
                    }
                </div>
            </BodyContent>
        </>
    );
}