import {Page, PageBody} from "@/components/common/page";
import ExerciseForm from "@/components/exercises/ExerciseForm";

export default function NewEventPage() {
    return (
        <Page>
            <PageBody>
                <ExerciseForm type={"Створити"}/>
            </PageBody>
        </Page>
    );
}