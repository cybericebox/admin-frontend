import {getExerciseFn} from "@/api/serverAPI";
import {Page, PageBody} from "@/components/common/page";
import {ExerciseForm} from "@/components/exercises";
import NotFound from "@/app/not-found";

interface ExercisePageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function ExercisePage(props: ExercisePageProps) {
    const params = await props.params;

    const {
        id
    } = params;

    const exerciseResponse = await getExerciseFn(id);
    // If the exercise is not found, return the NotFound page
    if (exerciseResponse?.Status?.Code === 31101) {
        return NotFound();
    }
    return (
        <Page>
            <PageBody>
                <ExerciseForm exercise={exerciseResponse.Data}/>
            </PageBody>
        </Page>
    );
}