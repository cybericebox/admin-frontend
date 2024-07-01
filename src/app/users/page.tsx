import UsersTable from "@/components/users/UsersTable";
import {Page, PageBody, PageHeader} from "@/components/common/page";

export default async function UsersPage() {
    return (
        <Page>
            <PageHeader>
                {/*<GoToCard*/}
                {/*    descIcon={FaRegCalendarPlus}*/}
                {/*    linkIcon={FaPlus}*/}
                {/*    title={"Запросити користувача"}*/}
                {/*    description={"Надіслати запит на приєднання"}*/}
                {/*    to={"/users/invite"}*/}
                {/*/>*/}
            </PageHeader>
            <PageBody>
                <UsersTable/>
            </PageBody>
        </Page>
    );
}