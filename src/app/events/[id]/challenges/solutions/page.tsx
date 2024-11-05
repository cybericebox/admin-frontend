import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common"
import {ArrowRight, Calendar, Flag} from "lucide-react";
import EventChallengeSolutionAttemptsTable
    from "@/components/events/challenges/solutions/EventChallengeSolutionAttemptsTable";

interface EventChallengeSolutionsPageProps {
    params: {
        id: string;
    };
}

export default function EventChallengeSolutionsPage({params: {id}}: EventChallengeSolutionsPageProps) {
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
                    DescIcon={Flag}
                    LinkIcon={ArrowRight}
                    title={"Повернутися до завдань"}
                    description={"Повернутися до завдань заходу"}
                    to={`/events/${id}/challenges`}
                />
            </PageHeader>
            <PageBody>
                <EventChallengeSolutionAttemptsTable eventID={id}/>
            </PageBody>
        </Page>
    );
}