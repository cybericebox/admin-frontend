"use client"
import {DeepRequired, FieldError, FieldErrorsImpl, Merge, SubmitHandler, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {ZodString} from "zod";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Button} from "@/components/ui/button";
import {BodyHeader} from "@/components/common/page";
import {InviteUsersSchema} from "@/types/user";
import {useUser} from "@/hooks/useUser";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import React from "react";
import {MultiTagInput} from "@/components/common";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";

export interface InviteUsersFormProps {
    onClose: () => void
}

export default function InviteUsersForm(props: InviteUsersFormProps) {
    const {InviteUsers, PendingInviteUsers} = useUser().useInviteUsers()

    const form = useForm<z.infer<typeof InviteUsersSchema>>({
        resolver: zodResolver(InviteUsersSchema),
        defaultValues: {
            Role: "Користувач",
            Emails: []
        },
        mode: "onChange"
    })

    function getIndicesPassingCondition<T>(array: Merge<FieldError, FieldErrorsImpl<Array<NonNullable<DeepRequired<ZodString["_output"]>>> & {}>> | undefined): number[] {
        const indices: number[] = [];

        for (const error in array) {
            if (error) {
                indices.push(Number(error));
            }
        }


        return indices;
    }

    const onSubmit: SubmitHandler<z.infer<typeof InviteUsersSchema>> = data => {
        InviteUsers(data, {
            onSuccess: () => {
                props.onClose()
            },
            onError: (error) => {
                const e = error as IErrorResponse
                ErrorToast({message: "Не вдалося додати користувачів", error: e})
            }
        })
    }

    return (
        <>
            <BodyHeader title={"Додати користувачів"}/>
            <div>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex flex-col gap-3"
                    >

                        <div className="flex flex-col gap-5 md:flex-row w-full">
                            <FormField
                                control={form.control}
                                name="Role"
                                render={({field}) => (
                                    <FormItem className="w-full">
                                        <FormLabel>Роль користувачів</FormLabel>
                                        <Select
                                            onValueChange={(value: string) => field.onChange(value)}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue/>
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem
                                                    value={"Адміністратор"}>Адміністратор</SelectItem>
                                                <SelectItem
                                                    value={"Користувач"}>Користувач</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage/>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex flex-col gap-5 md:flex-row">
                            <FormField
                                control={form.control}
                                name="Emails"
                                render={({field}) => (
                                    <FormItem className="w-full">
                                        <FormLabel>Адреси електронних пошт користувачів</FormLabel>
                                        <FormControl>
                                            <MultiTagInput
                                                tags={field.value}
                                                setTags={field.onChange}
                                                errorTagsIndexes={getIndicesPassingCondition(form.formState.errors.Emails)}
                                                placeholder={"Адреси електронної пошти..."}
                                                className="max-h-44"
                                            />
                                        </FormControl>
                                        <FormMessage/>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div
                            className="flex gap-5 flex-row justify-evenly w-full"
                        >
                            <Button
                                type="submit"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                            >
                                {(PendingInviteUsers) ? (
                                    'Опрацювання...'
                                ) : "Додати"}
                            </Button>
                            <Button
                                type="reset"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                                onClick={props.onClose}
                            >
                                Відмінити
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </>
    )
}
