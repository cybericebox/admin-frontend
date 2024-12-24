import {Page, PageBody} from "@/components/common/page";
import {ExerciseForm} from "@/components/exercises";

export default function NewExercisePage() {
    return (
        <Page>
            <PageBody>
                <ExerciseForm/>
            </PageBody>
        </Page>
    );
}