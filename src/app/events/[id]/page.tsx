import EventForm from "@/components/events/EventForm";
import {getEventFn} from "@/api/serverAPI";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import {ArrowRight, Flag, UsersRound} from "lucide-react";
import NotFound from "@/app/not-found";
import {ParticipationTypeEnum} from "@/types/event";


interface EventPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EventPage(props: EventPageProps) {
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
                    DescIcon={UsersRound}
                    LinkIcon={ArrowRight}
                    title={"Реєстрація учасників"}
                    description={"Переглянути реєстрацію учасників"}
                    to={`/events/${id}/participants`}
                />
                <GoToCard
                    DescIcon={UsersRound}
                    LinkIcon={ArrowRight}
                    title={eventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Учасники" : "Команди"}
                    description={eventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Переглянути учасників заходу" : "Переглянути команди заходу"}
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
                <EventForm event={eventResponse?.Data}/>
            </PageBody>
        </Page>
    );
}