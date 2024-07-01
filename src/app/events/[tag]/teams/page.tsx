import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common"
import {FaRegCalendarPlus} from "react-icons/fa";
import {MdArrowForward} from "react-icons/md";
import EventTeamsTable from "@/components/events/EventTeamsTable";

interface EventTeamsPageProps {
    params: {
        tag: string;
    };
}

export default function EventTeamsPage({params: {tag}}: EventTeamsPageProps) {
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    descIcon={FaRegCalendarPlus}
                    linkIcon={MdArrowForward}
                    title={"Повернутися до заходу"}
                    description={"Повернутися до налаштувань заходу"}
                    to={`/events/${tag}`}
                />
            </PageHeader>
            <PageBody>
                <EventTeamsTable eventTag={tag}/>
            </PageBody>
        </Page>
    );
}