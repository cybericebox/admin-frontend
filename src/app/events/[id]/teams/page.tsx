import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common"
import EventTeamsTable from "@/components/events/teams/EventTeamsTable";
import {ArrowRight, Calendar, Flag, UsersRound} from "lucide-react";

interface EventTeamsPageProps {
    params: {
        id: string;
    };
}

export default function EventTeamsPage({params: {id}}: EventTeamsPageProps) {
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
                    title={"Реєстрація учасників"}
                    description={"Переглянути реєстрацію учасників"}
                    to={`/events/${id}/participants`}
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
                <EventTeamsTable eventID={id}/>
            </PageBody>
        </Page>
    );
}