import EventForm from "@/components/events/EventForm";
import {Page, PageBody} from "@/components/common/page";

export default function NewEventPage() {
    return (
        <Page>
            <PageBody>
                <EventForm/>
            </PageBody>
        </Page>
    );
}