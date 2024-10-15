import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import ChallengesView from "@/components/events/challenges/ChallengesView";
import {ArrowRight, CalendarPlus} from "lucide-react";

interface EventChallengesPageProps {
    params: {
        id: string;
    };
}

export default async function EventChallengesPage({params: {id}}: EventChallengesPageProps) {
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    DescIcon={CalendarPlus}
                    LinkIcon={ArrowRight}
                    title={"Повернутися до заходу"}
                    description={"Повернутися до налаштувань заходу"}
                    to={`/events/${id}`}
                />
            </PageHeader>
            <PageBody>
                <ChallengesView eventID={id}/>
            </PageBody>
        </Page>
    );
}