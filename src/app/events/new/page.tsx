import EventForm from "@/components/events/EventForm";
import {Page, PageBody} from "@/components/common/page";
import getEnv from "@/utils/helper";

export default function NewEventPage() {
    const domain = getEnv("DOMAIN") || ""
    return (
        <Page>
            <PageBody>
                <EventForm type={"Створити"} domain={domain}/>
            </PageBody>
        </Page>
    );
}