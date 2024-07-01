import {getExerciseByIDFn} from "@/api/serverAPI";
import {Page, PageBody} from "@/components/common/page";
import ExerciseForm from "@/components/exercises/ExerciseForm";

interface ExercisePageProps {
    params: {
        id: string;
    };
}

export default async function ExercisePage({params: {id}}: ExercisePageProps) {
    const exercise = await getExerciseByIDFn(id);
    return (
        <Page>
            <PageBody>
                <ExerciseForm type={"Зберегти"} exercise={exercise}/>
            </PageBody>
        </Page>
    );
}