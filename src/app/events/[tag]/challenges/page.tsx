import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import {FaRegCalendarPlus} from "react-icons/fa";
import {MdArrowForward} from "react-icons/md";
import ChallengesCard from "@/components/events/challenges/ChallengesCard";
import {getEventByTagFn} from "@/api/serverAPI";
import NotFound from "@/app/not-found";

interface EventChallengesPageProps {
    params: {
        tag: string;
    };
}

export default async function EventChallengesPage({params: {tag}}: EventChallengesPageProps) {
    const event = await getEventByTagFn(tag);
    console.log(event.ID)
    if (!event) return NotFound;

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
                <ChallengesCard eventID={event.ID!}/>
            </PageBody>
        </Page>
    );
}