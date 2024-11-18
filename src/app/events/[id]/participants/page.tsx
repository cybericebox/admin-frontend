import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common"
import {ArrowRight, Calendar, Flag, UsersRound} from "lucide-react";
import EventParticipantsTable from "@/components/events/participants/EventParticipantsTable";
import {ParticipationTypeEnum} from "@/types/event";
import {getEventFn} from "@/api/serverAPI";
import NotFound from "@/app/not-found";

interface EventParticipantsPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EventParticipantsPage(props: EventParticipantsPageProps) {
    const params = await props.params;

    const {
        id
    } = params;

    const eventResponse = await getEventFn(id);
    // If the event is not found, return the NotFound page
    if (eventResponse?.Status?.Code === 30000) {
        return NotFound
    }
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    DescIcon={Calendar}
                    LinkIcon={ArrowRight}
                    title={"Повернутися до заходу"}
                    description={"Повернутися до налаштувань заходу"}
                    to={`/events/${id}`}
                />
                <GoToCard
                    DescIcon={UsersRound}
                    LinkIcon={ArrowRight}
                    title={eventResponse.Data.Participation === ParticipationTypeEnum.Individual ? "Учасники" : "Команди"}
                    description={eventResponse.Data.Participation === ParticipationTypeEnum.Individual ? "Переглянути учасників заходу" : "Переглянути команди заходу"}
                    to={`/events/${id}/teams`}
                />
                <GoToCard
                    DescIcon={Flag}
                    LinkIcon={ArrowRight}
                    title={"Завдання"}
                    description={"Переглянути завданнь заходу"}
                    to={`/events/${id}/challenges`}
                />
            </PageHeader>
            <PageBody>
                <EventParticipantsTable eventID={id}/>
            </PageBody>
        </Page>
    );
}