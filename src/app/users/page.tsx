"use client";
import {Page, PageBody, PageHeader} from "@/components/common/page";
import {GoToCard} from "@/components/common";
import {Plus, UserRoundPlus} from "lucide-react";
import {DialogForm} from "@/components/common/form";
import {useState} from "react";
import {Users, InviteUsersForm} from "@/components/users";


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
                <Users/>
                <DialogForm isOpen={openDialogForm} onClose={() => setOpenDialogForm(false)}>
                    <InviteUsersForm onClose={() => setOpenDialogForm(false)}/>
                </DialogForm>
            </PageBody>
        </Page>
    );
}