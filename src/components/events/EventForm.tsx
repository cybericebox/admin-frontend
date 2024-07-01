"use client"
import {SubmitHandler, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import type {Event} from "@/types/event";
import {EventSchema} from "@/types/event"
import {useEvent} from "@/hooks/useEvent";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Button} from "@/components/ui/button";
import "react-datepicker/dist/react-datepicker.css";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";
import EventURLFieldInput from "@/components/events/eventURLFieldInput";
import {DateTimePicker} from "@/components/ui/datetime-picker";
import {useRouter} from "next/navigation";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {FormButtons, FormFields, FormProvider} from "@/components/common/form";
import {useEffect} from "react";

export interface EventFormProps {
    type: "Створити" | "Зберегти"
    event?: Event
    domain: string
}

export default function EventForm({type, event, domain}: EventFormProps) {
    const createEvent = useEvent().useCreateEvent()
    const updateEvent = useEvent().useUpdateEvent()
    const router = useRouter()

    const form = useForm<z.infer<typeof EventSchema>>({
        resolver: zodResolver(EventSchema),
        defaultValues: {
            Name: event?.Name || "",
            Tag: event?.Tag || "",
            Picture: event?.Picture || "",
            Description: event?.Description || "",
            Rules: event?.Rules || "",
            Type: type === "Зберегти" ? event?.Type : 0,
            Participation: type === "Зберегти" ? event?.Participation : 1,
            Availability: type === "Зберегти" ? event?.Availability : 0,
            Registration: type === "Зберегти" ? event?.Registration : 0,
            ParticipantsVisibility: type === "Зберегти" ? event?.ParticipantsVisibility : 0,
            ScoreboardAvailability: type === "Зберегти" ? event?.ScoreboardAvailability : 1,
            PublishTime: event ? new Date(event.PublishTime) : new Date(),
            StartTime: event ? new Date(event.StartTime) : new Date(),
            FinishTime: event ? new Date(event.FinishTime) : new Date(),
            WithdrawTime: event ? new Date(event.WithdrawTime) : new Date(),
            DynamicScoring: event?.DynamicScoring || false,
            DynamicMinScore: event?.DynamicMinScore || 1,
            DynamicMaxScore: event?.DynamicMaxScore || 1,
            DynamicSolveThreshold: event?.DynamicSolveThreshold || 1,
        },
        mode: type === "Зберегти" ? "onBlur" : "onChange"
    })

    const onSubmit: SubmitHandler<z.infer<typeof EventSchema>> = data => {
        if (type === "Зберегти") {
            updateEvent.mutate({...data, ID: event?.ID})
        } else {
            createEvent.mutate(data)
        }
    }

    useEffect(() => {
        if (createEvent.isSuccess || updateEvent.isSuccess) {
            router.push("/events")
        }
    }, [createEvent.isSuccess, updateEvent.isSuccess])

    return (
        <>
            <BodyHeader title={type === "Створити" ? "Новий захід" : form.watch("Name")}/>
            <BodyContent>
                <Form {...form}>
                    <FormProvider
                        onSubmit={form.handleSubmit(onSubmit)}
                    >
                        <FormFields>
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
                                            <FormLabel>Посилання захід</FormLabel>
                                            <FormControl>
                                                <EventURLFieldInput field={field} fieldState={fieldState}
                                                                    domain={domain} disabled={type === "Зберегти"}
                                                />
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )
                                    }/>
                                <FormField
                                    control={form.control}
                                    name="Picture"
                                    render={({field}) => (
                                        <FormItem className="w-full">
                                            <FormLabel>Посилання на банер</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Посилання" {...field}/>
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}/>
                            </div>
                            <div className="flex flex-col gap-5 md:flex-row w-full">
                                <FormField
                                    control={form.control}
                                    name="Type"
                                    render={({field}) => (
                                        <FormItem className="w-full">
                                            <FormLabel>Тип заходу</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(Number(value))}
                                                defaultValue={field.value.toString()}
                                                disabled={type === "Зберегти"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="0">Змагання</SelectItem>
                                                    <SelectItem value="1">Тренування</SelectItem>
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
                                                onValueChange={(value) => field.onChange(Number(value))}
                                                defaultValue={field.value.toString()}
                                                disabled={type === "Зберегти"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="0">Індивідуальний</SelectItem>
                                                    <SelectItem value="1">Командний</SelectItem>
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
                                    name="Description"
                                    render={({field}) => (
                                        <FormItem className="w-full">
                                            <FormLabel>Опис заходу</FormLabel>
                                            <FormControl className="h-44">
                                                <Textarea placeholder="Опис..." {...field}
                                                          className="textarea rounded-2xl"/>
                                            </FormControl>
                                            <FormMessage/>
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
                                                <Textarea placeholder="Правила..." {...field}
                                                          className="textarea rounded-2xl"/>
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col gap-5 md:flex-row w-full">
                                <FormField
                                    control={form.control}
                                    name="Registration"
                                    render={({field}) => (
                                        <FormItem className="w-full">
                                            <FormLabel>Статус реєстрації</FormLabel>
                                            <Select onValueChange={(value) => field.onChange(Number(value))}
                                                    defaultValue={field.value.toString()}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="0">Відкрита</SelectItem>
                                                    <SelectItem value="1">За підтвердженням</SelectItem>
                                                    <SelectItem value="2">Закрита</SelectItem>
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
                                            <FormLabel>Доступність результатів</FormLabel>
                                            <Select onValueChange={(value) => field.onChange(Number(value))}
                                                    defaultValue={field.value.toString()}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="0">Недоступні</SelectItem>
                                                    <SelectItem value="1">Тільки для учасників</SelectItem>
                                                    <SelectItem value="2">Публічні</SelectItem>
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
                            <div className="flex flex-col gap-5 justify-between md:flex-row">
                                <FormField
                                    control={form.control}
                                    name="PublishTime"
                                    render={({field}) => (
                                        <FormItem className="flex flex-col w-full">
                                            <FormLabel>Дата публікації</FormLabel>
                                            <FormControl>
                                                <DateTimePicker
                                                    granularity="minute"
                                                    jsDate={field.value}
                                                    hourCycle={24}
                                                    onJsDateChange={field.onChange}

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
                                                    granularity="minute"
                                                    jsDate={field.value}
                                                    hourCycle={24}
                                                    onJsDateChange={field.onChange}

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
                                                    granularity="minute"
                                                    jsDate={field.value}
                                                    hourCycle={24}
                                                    onJsDateChange={field.onChange}

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
                                                    granularity="minute"
                                                    jsDate={field.value}
                                                    hourCycle={24}
                                                    onJsDateChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                            </div>
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
                        </FormFields>
                        <FormButtons>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                            >
                                {(createEvent.isPending || updateEvent.isPending) ? (
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