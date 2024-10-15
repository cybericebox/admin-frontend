"use client";
import UsersTable from "@/components/users/UsersTable";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import {Plus, UserRoundPlus} from "lucide-react";
import DialogForm from "@/components/common/DialogForm";
import {useState} from "react";
import InviteUsersForm from "@/components/users/InviteUsersForm";


export default function UsersPage() {
    const [openDialogForm, setOpenDialogForm] = useState<boolean>(false)
    return (
        <Page>
            <PageHeader>
                <GoToCard
                    DescIcon={UserRoundPlus}
                    LinkIcon={Plus}
                    title={"Додати користувачів"}
                    description={"Надіслати запрошення"}
                    onClick={() => setOpenDialogForm(true)}
                />
            </PageHeader>
            <PageBody>
                <UsersTable/>
                <DialogForm isOpen={openDialogForm} onClose={() => setOpenDialogForm(false)}>
                    <InviteUsersForm onClose={() => setOpenDialogForm(false)}/>
                </DialogForm>
            </PageBody>
        </Page>
    );
}