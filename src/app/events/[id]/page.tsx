import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import {ArrowRight, Flag, UsersRound} from "lucide-react";
import {ParticipationTypeEnum} from "@/types/event";
import EventForm from "@/components/events/EventForm";
import {getEventFn} from "@/api/serverAPI";
import NotFound from "@/app/not-found";


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

    const getEventResponse = await getEventFn(id);

    if (getEventResponse?.Status?.Code == 31301) {
        return NotFound();
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
                    title={getEventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Учасники" : "Команди"}
                    description={getEventResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Переглянути учасників заходу" : "Переглянути команди заходу"}
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
                <EventForm event={getEventResponse?.Data}/>
            </PageBody>
        </Page>
    );
}