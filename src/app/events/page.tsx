import {GoToCard} from "@/components/common";
import {FaPlus, FaRegCalendarPlus} from "react-icons/fa";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import EventsTable from "@/components/events/EventsTable";
import getEnv from "@/utils/helper";

export default function EventsPage() {
    const domain = getEnv("DOMAIN")
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    descIcon={FaRegCalendarPlus}
                    linkIcon={FaPlus}
                    title={"Створити захід"}
                    description={"Назва, завдання, дата та час ..."}
                    to={"/events/new"}
                />
            </PageHeader>
            <PageBody>
                <EventsTable domain={domain || ""}/>
            </PageBody>
        </Page>
    );
}