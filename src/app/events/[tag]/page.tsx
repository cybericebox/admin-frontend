import EventForm from "@/components/events/EventForm";
import {getEventByTagFn} from "@/api/serverAPI";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import {FaUsers} from "react-icons/fa";
import {MdArrowForward, MdOutlinedFlag} from "react-icons/md";
import getEnv from "@/utils/helper";

interface EventPageProps {
    params: {
        tag: string;
    };
}

export default async function EventPage({params: {tag}}: EventPageProps) {
    const domain = getEnv("DOMAIN") || ""
    const event = await getEventByTagFn(tag);
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    descIcon={FaUsers}
                    linkIcon={MdArrowForward}
                    title={"Команди"}
                    description={"Переглянути команд заходу"}
                    to={`/events/${tag}/teams`}
                />
                <GoToCard
                    descIcon={MdOutlinedFlag}
                    linkIcon={MdArrowForward}
                    title={"Завдання"}
                    description={"Переглянути завданнь заходу"}
                    to={`/events/${tag}/challenges`}
                />
            </PageHeader>
            <PageBody>
                <EventForm type={"Зберегти"} event={event} domain={domain}/>
            </PageBody>
        </Page>
    );
}