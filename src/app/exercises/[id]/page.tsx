import {getExerciseFn} from "@/api/serverAPI";
import {Page, PageBody} from "@/components/common/page";
import ExerciseForm from "@/components/exercises/ExerciseForm";
import NotFound from "@/app/not-found";

interface ExercisePageProps {
    params: {
        id: string;
    };
}

export default async function ExercisePage({params: {id}}: ExercisePageProps) {
    const exerciseResponse = await getExerciseFn(id);
    // If the exercise is not found, return the NotFound page
    if (exerciseResponse?.Status?.Code === 30000) {
        return NotFound
    }
    return (
        <Page>
            <PageBody>
                <ExerciseForm exercise={exerciseResponse.Data}/>
            </PageBody>
        </Page>
    );
}