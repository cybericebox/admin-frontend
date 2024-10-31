"use client"
import {SubmitHandler, useFieldArray, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Button} from "@/components/ui/button";
import {BodyHeader} from "@/components/common/page";
import {InviteUsersSchema, UserRoleEnum} from "@/types/user";
import {useUser} from "@/hooks/useUser";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import React from "react";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";
import {FormButtons, FormFields, FormProvider} from "@/components/common/form";
import {Input} from "@/components/ui/input";
import {DeleteIcon} from "@/components/common/delete";

export interface InviteUsersFormProps {
    onClose: () => void
}

export default function InviteUsersForm(props: InviteUsersFormProps) {
    const {InviteUsers, PendingInviteUsers} = useUser().useInviteUsers()

    const form = useForm<z.infer<typeof InviteUsersSchema>>({
        resolver: zodResolver(InviteUsersSchema),
        defaultValues: {
            Role: UserRoleEnum.User,
            Emails: [{Email: ""}]
        },
        mode: "onChange"
    })

    const emails = useFieldArray({
        control: form.control,
        name: "Emails",
    })

    const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>, oldValue: string): Record<string, string> => {
        const value = e.target.value
        if (value.length && !oldValue.length) {
            const ts = value.split(" ")
            if (ts.length > 1) {
                ts.slice(1).forEach((t) => {
                    emails.append({Email: t}, {
                        shouldFocus: true,
                        focusName: `Emails.${form.watch("Emails").length}`
                    })
                })
                return {Email: ts[0]}
            }
        }
        return {Email: value}
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
                    <FormProvider
                        onSubmit={form.handleSubmit(onSubmit)}
                    >
                        <FormFields>
                            <FormField
                                control={form.control}
                                name="Role"
                                render={({field}) => (
                                    <FormItem className="w-full">
                                        <FormLabel>Роль користувачів</FormLabel>
                                        <Select
                                            name={"Role"}
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
                            <FormField
                                name={`Emails`}
                                control={form.control}
                                render={() => (
                                    <FormItem>
                                        <FormControl>
                                            <>
                                                <div className={"mt-4"}>
                                                    <FormLabel>Адреси електронних пошт користувачів</FormLabel>
                                                </div>
                                                <FormMessage/>
                                                <div className={"w-full flex flex-col"}>
                                                    {
                                                        emails.fields.map((email, index) => {
                                                            return (

                                                                <FormField
                                                                    key={email.id}
                                                                    control={form.control}
                                                                    name={`Emails.${index}`}
                                                                    render={({field}) => (
                                                                        <FormItem className="w-full">
                                                                            <FormControl>
                                                                                <div
                                                                                    className={"relative"}>
                                                                                    <Input
                                                                                        {...field}
                                                                                        value={field.value.Email}
                                                                                        onChange={(e) => {
                                                                                            field.onChange(onChangeEmail(e, field.value.Email))
                                                                                        }}
                                                                                        type={"email"}
                                                                                        className={"w-full"}
                                                                                        placeholder={"Адреса електронної пошти..."}
                                                                                    />
                                                                                    <DeleteIcon

                                                                                        cross={true}
                                                                                        className={"cursor-pointer top-2 right-1 absolute"}
                                                                                        onClick={() => {
                                                                                            emails.remove(index)
                                                                                        }}/>
                                                                                </div>

                                                                            </FormControl>
                                                                            <FormMessage/>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            )
                                                        })
                                                    }
                                                    <Button
                                                        type={"button"}
                                                        onClick={() => {
                                                            emails.append({
                                                                Email: ""
                                                            }, {
                                                                shouldFocus: true,
                                                                focusName: `Emails.${emails.fields.length}`
                                                            })
                                                        }}
                                                    >
                                                        Додати адресу електронної пошти
                                                    </Button>
                                                </div>
                                            </>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </FormFields>
                        <FormButtons
                            show={form.formState.isDirty}
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
                        </FormButtons>
                    </FormProvider>
                </Form>
            </div>
        </>
    )
}
