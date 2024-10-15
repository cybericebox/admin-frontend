import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common"
import EventTeamsTable from "@/components/events/EventTeamsTable";
import {ArrowRight, Calendar} from "lucide-react";

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
            </PageHeader>
            <PageBody>
                <EventTeamsTable eventID={id}/>
            </PageBody>
        </Page>
    );
}