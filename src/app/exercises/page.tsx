'use client'
import {GoToCard} from "@/components/common";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import ExercisesCard from "@/components/exercises/ExercisesCard";
import {FaPlus} from "react-icons/fa";
import {MdOutlinedFlag} from "react-icons/md";

export default function ExercisesPage() {
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    descIcon={MdOutlinedFlag}
                    linkIcon={FaPlus}
                    title={"Створити завдання"}
                    description={"Назва, категорія, опис ..."}
                    to={"/exercises/new"}
                />
            </PageHeader>
            <PageBody>
                <ExercisesCard/>
            </PageBody>
        </Page>

    )
}
