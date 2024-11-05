import {GoToCard} from "@/components/common";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import {Exercises} from "@/components/exercises";
import {Flag, Plus} from "lucide-react";

export default function ExercisesPage() {
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    DescIcon={Flag}
                    LinkIcon={Plus}
                    title={"Створити завдання"}
                    description={"Назва, категорія, опис ..."}
                    to={"/exercises/new"}
                />
            </PageHeader>
            <PageBody>
                <Exercises/>
            </PageBody>
        </Page>

    )
}
