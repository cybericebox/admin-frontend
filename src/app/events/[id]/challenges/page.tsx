import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import ChallengesView from "@/components/events/challenges/ChallengesView";
import {ArrowRight, CalendarPlus, Flag, UsersRound} from "lucide-react";
import {getEventFn} from "@/api/serverAPI";
import NotFound from "@/app/not-found";
import {ParticipationTypeEnum} from "@/types/event";

interface EventChallengesPageProps {
    params: {
        id: string;
    };
}

export default async function EventChallengesPage({params: {id}}: EventChallengesPageProps) {
    const eventResponse = await getEventFn(id);
    // If the event is not found, return the NotFound page
    if (eventResponse?.Status?.Code === 30000) {
        return NotFound
    }
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    DescIcon={Flag}
                    LinkIcon={ArrowRight}
                    title={"Рішення"}
                    description={"Переглянути рішення завдань"}
                    to={`/events/${id}/challenges/solutions`}
                />
                <GoToCard
                    DescIcon={CalendarPlus}
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
            </PageHeader>
            <PageBody>
                <ChallengesView eventID={id}/>
            </PageBody>
        </Page>
    );
}