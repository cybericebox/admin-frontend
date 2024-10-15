import {GoToCard} from "@/components/common";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import EventsTable from "@/components/events/EventsTable";
import {CalendarPlus, Plus} from "lucide-react";

export default function EventsPage() {
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    DescIcon={CalendarPlus}
                    LinkIcon={Plus}
                    title={"Створити захід"}
                    description={"Назва, завдання, дата та час ..."}
                    to={"/events/new"}
                />
            </PageHeader>
            <PageBody>
                <EventsTable/>
            </PageBody>
        </Page>
    );
}