"use client"
import {SubmitHandler, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    AvailabilityTypeEnum,
    EventSchema,
    EventTypeEnum,
    IEvent,
    ParticipantsVisibilityTypeEnum,
    ParticipationTypeEnum,
    RegistrationTypeEnum,
    ScoreboardVisibilityTypeEnum
} from "@/types/event";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger,} from "@/components/ui/accordion"
import {useEvent} from "@/hooks/useEvent";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";
import EventURLFieldInput from "@/components/events/eventURLFieldInput";
import DateTimePicker from "@/components/events/dateTimePicker";
import {useRouter} from "next/navigation";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {FormButtons, FormFields, FormProvider} from "@/components/common/form";
import EventBannerField from "@/components/events/EventBannerField";
import TextEditor from "@/components/common/editor";
import React, {useState} from "react";
import {cn} from "@/utils/cn";
import toast from "react-hot-toast";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";
import {invalidateTag} from "@/api/serverAPI";

export interface EventFormProps {
    event?: IEvent;
}

type AccordionItemType = "Main" | "View" | "Access" | "Datetime" | "Additional"

export default function EventForm({event}: EventFormProps) {
    const type = event?.ID ? "Зберегти" : "Створити"
    const {CreateEvent, PendingCreateEvent} = useEvent().useCreateEvent()
    const {UpdateEvent, PendingUpdateEvent} = useEvent().useUpdateEvent()
    const router = useRouter()
    const [selectedAccordion, setSelectedAccordion] = useState<AccordionItemType>("Main")

    const form = useForm<z.infer<typeof EventSchema>>({
        resolver: zodResolver(EventSchema),
        defaultValues: {
            ID: event?.ID || undefined,
            Name: event?.Name || "",
            Tag: event?.Tag || "",
            Picture: event?.Picture || "",
            Description: event?.Description || "",
            Rules: event?.Rules || "",
            Type: type === "Зберегти" ? event?.Type : EventTypeEnum.Competition,
            Participation: type === "Зберегти" ? event?.Participation : ParticipationTypeEnum.Team,
            Availability: type === "Зберегти" ? event?.Availability : AvailabilityTypeEnum.Private,
            Registration: type === "Зберегти" ? event?.Registration : RegistrationTypeEnum.Open,
            ParticipantsVisibility: type === "Зберегти" ? event?.ParticipantsVisibility : ParticipantsVisibilityTypeEnum.Private,
            ScoreboardAvailability: type === "Зберегти" ? event?.ScoreboardAvailability : ScoreboardVisibilityTypeEnum.Private,
            PublishTime: event ? new Date(event.PublishTime) : new Date(Date.now()),
            StartTime: event ? new Date(event.StartTime) : new Date(Date.now()),
            FinishTime: event ? new Date(event.FinishTime) : new Date(Date.now() + 24 * 60 * 60 * 1000),
            WithdrawTime: event ? new Date(event.WithdrawTime) : new Date(Date.now() + 24 * 60 * 60 * 1000),
            DynamicScoring: event?.DynamicScoring || false,
            DynamicMinScore: event?.DynamicMinScore || 1,
            DynamicMaxScore: event?.DynamicMaxScore || 1,
            DynamicSolveThreshold: event?.DynamicSolveThreshold || 1,
        },
        mode: "onChange"
    })

    const onSubmit: SubmitHandler<z.infer<typeof EventSchema>> = data => {

        if (type === "Зберегти") {
            UpdateEvent({...data}, {
                onSuccess: () => {
                    toast.success("Захід успішно оновлено")
                    form.control._resetDefaultValues()
                    invalidateTag(`/events/${event?.ID}`)
                    router.push("/events")

                },
                onError: (error) => {
                    const e = error as IErrorResponse
                    ErrorToast({message: "Не вдалося оновити захід", error: e})
                },
            })
        } else {
            CreateEvent({...data}, {
                onSuccess: () => {
                    toast.success("Захід успішно створено")
                    form.reset()
                    router.push("/events")
                },
                onError: (error) => {
                    const e = error as IErrorResponse
                    ErrorToast({message: "Не вдалося створити захід", error: e})
                },
            })
        }
    }

    // prevent page reload on form dirty
    if (form.formState.isDirty && typeof window !== "undefined" && !window.onbeforeunload) {
        window.onbeforeunload = () => true
    }
    // remove page reload on form clean
    if (!form.formState.isDirty && typeof window !== "undefined" && window.onbeforeunload) {
        window.onbeforeunload = null
    }

    const onSwitch = (value: AccordionItemType) => {
        if (value === selectedAccordion) return
        if (selectedAccordion === "Main") {
            form.trigger(["Name", "Tag", "Type", "Participation"])
        } else if (selectedAccordion === "View") {
            form.trigger(["Picture", "Description", "Rules"])
        } else if (selectedAccordion === "Access") {
            form.trigger(["Registration", "ScoreboardAvailability", "ParticipantsVisibility"])
        } else if (selectedAccordion === "Datetime") {
            form.trigger(["PublishTime", "StartTime", "FinishTime", "WithdrawTime"])
        } else if (selectedAccordion === "Additional") {
            form.trigger("DynamicScoring")
            if (form.getValues("DynamicScoring")) {
                form.trigger(["DynamicMinScore", "DynamicMaxScore", "DynamicSolveThreshold"])
            }
            setSelectedAccordion(value)
        }
    }

    return (
        <>
            <BodyHeader title={type === "Створити" ? "Новий захід" : form.watch("Name")}/>
            <BodyContent>
                <Form {...form}>
                    <FormProvider
                        onSubmit={form.handleSubmit(onSubmit)}
                    >
                        <FormFields>
                            <Accordion type={"single"} className="w-full" defaultValue={"Main"} collapsible={true}
                                       onValueChange={onSwitch}>
                                <AccordionItem value={"Main"}>
                                    <AccordionTrigger
                                        className={cn((form.formState.errors?.Name || form.formState.errors?.Tag || form.formState.errors.Type || form.formState.errors.Participation) && "text-destructive", "text-2xl")}>Головне</AccordionTrigger>
                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                        <div className="flex flex-col gap-5 md:flex-row w-full">
                                            <FormField
                                                control={form.control}
                                                name="Name"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Назва заходу</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Назва..." {...field}/>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="Tag"
                                                render={({field, fieldState}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Посилання на захід</FormLabel>
                                                        <FormControl>
                                                            <EventURLFieldInput field={field} fieldState={fieldState}
                                                                                disabled={type === "Зберегти"}
                                                            />
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )
                                                }/>
                                        </div>
                                        <div className="flex flex-col gap-5 md:flex-row w-full">
                                            <FormField
                                                control={form.control}
                                                name="Type"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Тип заходу</FormLabel>
                                                        <Select
                                                            onValueChange={(value: string) => field.onChange(Number(value))}
                                                            defaultValue={field.value?.toString()}
                                                            disabled={type === "Зберегти"}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue/>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    value={`${EventTypeEnum.Competition}`}>Змагання</SelectItem>
                                                                <SelectItem
                                                                    value={`${EventTypeEnum.Practice}`}>Тренування</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="Participation"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Тип участі</FormLabel>
                                                        <Select
                                                            onValueChange={(value: string) => field.onChange(Number(value))}
                                                            defaultValue={field.value?.toString()}
                                                            disabled={type === "Зберегти"}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue/>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    value={`${ParticipationTypeEnum.Individual}`}>Індивідуальний</SelectItem>
                                                                <SelectItem
                                                                    value={`${ParticipationTypeEnum.Team}`}>Командний</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value={"View"}>
                                    <AccordionTrigger
                                        className={cn((form.formState.errors?.Picture || form.formState.errors?.Description || form.formState.errors.Rules) && "text-destructive", "text-2xl")}>Зовнішній
                                        вигляд</AccordionTrigger>
                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                        <div className="flex flex-col gap-5 md:flex-row w-full">
                                            <FormField
                                                control={form.control}
                                                name="Picture"
                                                render={({field, fieldState, formState}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Банер</FormLabel>
                                                        <FormControl>
                                                            <EventBannerField
                                                                field={field}
                                                                oldImage={formState.defaultValues?.Picture}
                                                                fieldState={fieldState}
                                                                eventID={event?.ID}
                                                            />
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}/>
                                        </div>
                                        <div className="flex flex-col gap-5">
                                            <FormField
                                                control={form.control}
                                                name="Description"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Опис заходу</FormLabel>
                                                        <FormControl className="h-44">
                                                            <TextEditor
                                                                {...field}
                                                                minCharacters={2}
                                                                maxCharacters={5000}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="Rules"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Правила заходу</FormLabel>
                                                        <FormControl className="h-44">
                                                            <TextEditor
                                                                {...field}
                                                                minCharacters={2}
                                                                maxCharacters={5000}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value={"Access"}>
                                    <AccordionTrigger
                                        className={cn((form.formState.errors?.Registration || form.formState.errors?.ScoreboardAvailability || form.formState.errors.ParticipantsVisibility) && "text-destructive", "text-2xl")}>Доступність</AccordionTrigger>
                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                        <div className="flex flex-col gap-5 md:flex-row w-full">
                                            <FormField
                                                control={form.control}
                                                name="Registration"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Статус реєстрації</FormLabel>
                                                        <Select
                                                            onValueChange={(value: string) => field.onChange(Number(value))}
                                                            defaultValue={field.value?.toString()}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue/>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    value={`${RegistrationTypeEnum.Open}`}>Відкрита</SelectItem>
                                                                <SelectItem value={`${RegistrationTypeEnum.Approval}`}>За
                                                                    підтвердженням</SelectItem>
                                                                <SelectItem
                                                                    value={`${RegistrationTypeEnum.Close}`}>Закрита</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="ScoreboardAvailability"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Результати</FormLabel>
                                                        <Select
                                                            onValueChange={(value: string) => field.onChange(Number(value))}
                                                            defaultValue={field.value?.toString()}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue/>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    value={`${ScoreboardVisibilityTypeEnum.Hidden}`}>Недоступні</SelectItem>
                                                                <SelectItem
                                                                    value={`${ScoreboardVisibilityTypeEnum.Private}`}>Тільки
                                                                    для учасників</SelectItem>
                                                                <SelectItem
                                                                    value={`${ScoreboardVisibilityTypeEnum.Public}`}>Публічні</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            {/*<FormField*/}
                                            {/*    control={form.control}*/}
                                            {/*    name="ParticipantsVisibility"*/}
                                            {/*    render={({field}) => (*/}
                                            {/*        <FormItem className="w-full">*/}
                                            {/*            <FormLabel>Доступність переліку учасників</FormLabel>*/}
                                            {/*            <Select onValueChange={(value) => field.onChange(Number(value))}*/}
                                            {/*                    defaultValue={field.value.toString()}>*/}
                                            {/*                <FormControl>*/}
                                            {/*                    <SelectTrigger>*/}
                                            {/*                        <SelectValue defaultValue={"0"}/>*/}
                                            {/*                    </SelectTrigger>*/}
                                            {/*                </FormControl>*/}
                                            {/*                <SelectContent>*/}
                                            {/*                    <SelectItem value="0">Недоступні</SelectItem>*/}
                                            {/*                    <SelectItem value="1">Тільки для учасників</SelectItem>*/}
                                            {/*                    <SelectItem value="2">Публічні</SelectItem>*/}
                                            {/*                </SelectContent>*/}
                                            {/*            </Select>*/}
                                            {/*            <FormMessage/>*/}
                                            {/*        </FormItem>*/}
                                            {/*    )}*/}
                                            {/*/>*/}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value={"Datetime"}>
                                    <AccordionTrigger
                                        className={cn((form.formState.errors?.PublishTime || form.formState.errors?.StartTime || form.formState.errors.FinishTime || form.formState.errors.WithdrawTime) && "text-destructive", "text-2xl")}>Дата
                                        та час</AccordionTrigger>
                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                        <div className="flex flex-col gap-5 justify-between md:flex-row">
                                            <FormField
                                                control={form.control}
                                                name="PublishTime"
                                                render={({field}) => (
                                                    <FormItem className="flex flex-col w-full">
                                                        <FormLabel>Дата публікації</FormLabel>
                                                        <FormControl>
                                                            <DateTimePicker
                                                                onChange={(date) => field.onChange(date)}
                                                                value={new Date}
                                                                placeholder={"Оберіть дату публікації"}
                                                            />
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="StartTime"
                                                render={({field}) => (
                                                    <FormItem className="flex flex-col w-full">
                                                        <FormLabel>Дата початку</FormLabel>
                                                        <FormControl>
                                                            <DateTimePicker
                                                                {...field}
                                                                placeholder={"Оберіть дату початку"}
                                                            />
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-5 justify-between md:flex-row">
                                            <FormField
                                                control={form.control}
                                                name="FinishTime"
                                                render={({field}) => (
                                                    <FormItem className="flex flex-col w-full">
                                                        <FormLabel>Дата закінчення</FormLabel>
                                                        <FormControl>
                                                            <DateTimePicker
                                                                {...field}
                                                                placeholder={"Оберіть дату закінчення"}

                                                            />
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="WithdrawTime"
                                                render={({field}) => (
                                                    <FormItem className="flex flex-col w-full">
                                                        <FormLabel>Дата архівації</FormLabel>
                                                        <FormControl>
                                                            <DateTimePicker
                                                                {...field}
                                                                placeholder={"Оберіть дату архівації"}
                                                            />
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value={"Additional"}>
                                    <AccordionTrigger
                                        className={cn((form.formState.errors?.DynamicScoring || form.formState.errors?.DynamicMinScore || form.formState.errors.DynamicMaxScore || form.formState.errors.DynamicSolveThreshold) && "text-destructive", "text-2xl")}>Додаткове</AccordionTrigger>
                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                        <div className="flex flex-col gap-5 w-full">
                                            <FormField
                                                control={form.control}
                                                name="DynamicScoring"
                                                render={({field}) => (
                                                    <FormItem className="flex flex-row items-center h-5">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                                className={"h-5 w-5 mr-2"}
                                                            />
                                                        </FormControl>
                                                        <FormLabel
                                                            className={"h-full"}
                                                        >Використовувати динамічне оцінювання</FormLabel>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}/>
                                            {form.getValues("DynamicScoring") && (
                                                <div className="flex flex-col gap-5 md:flex-row w-full">
                                                    <FormField
                                                        control={form.control}
                                                        name="DynamicMinScore"
                                                        render={({field: {onChange, value, ...rest}}) => (
                                                            <FormItem className="w-full">
                                                                <FormLabel>Мінімальний бал</FormLabel>
                                                                <FormControl>
                                                                    <Input {...rest}
                                                                           onChange={(event) => {
                                                                               onChange(Number(event.target.value))
                                                                           }
                                                                           }
                                                                           min={1}
                                                                           value={value.toString()}
                                                                           type={"number"}/>
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="DynamicMaxScore"
                                                        render={({field: {onChange, value, ...rest}}) => (
                                                            <FormItem className="w-full">
                                                                <FormLabel>Максимальний бал</FormLabel>
                                                                <FormControl>
                                                                    <Input {...rest}
                                                                           onChange={(event) => {
                                                                               onChange(Number(event.target.value))
                                                                           }
                                                                           }
                                                                           min={1}
                                                                           value={value.toString()}
                                                                           type={"number"}/>
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="DynamicSolveThreshold"
                                                        render={({field: {onChange, value, ...rest}}) => (
                                                            <FormItem className="w-full">
                                                                <FormLabel>Поріг розвʼзань</FormLabel>
                                                                <FormControl>
                                                                    <Input {...rest}
                                                                           onChange={(event) => {
                                                                               onChange(Number(event.target.value))
                                                                           }
                                                                           }
                                                                           min={1}
                                                                           value={value.toString()}
                                                                           type={"number"}/>
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </FormFields>
                        <FormButtons>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                            >
                                {(PendingCreateEvent || PendingUpdateEvent) ? (
                                    'Опрацювання...'
                                ) : `${type}`}
                            </Button>
                            <Button
                                type="reset"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                                onClick={() => router.push("/events")}
                            >
                                Відмінити
                            </Button>
                        </FormButtons>
                    </FormProvider>
                </Form>
            </BodyContent>
        </>
    )
}