"use client"
import {type SubmitHandler, useFieldArray, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Button} from "@/components/ui/button";
import {useRouter} from "next/navigation";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {FormButtons, FormFields, FormProvider} from "@/components/common/form";
import {ExerciseSchema, type IExercise} from "@/types/exercise";
import {useExercise} from "@/hooks/useExercise";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import React, {useState} from "react";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import ExerciseFileForm, {AddExerciseFileButton} from "./ExerciseFileForm";
import ExerciseInstanceForm from "./ExerciseInstanceForm";
import ExerciseTaskForm from "./ExerciseTaskForm";
import {cn} from "@/utils/cn";
import TextEditor from "@/components/common/editor";
import {AccordionHeader} from "@radix-ui/react-accordion";
import ExerciseCategoryForm from "./CategoryForm";
import {DialogForm} from "@/components/common";
import {ErrorToast, SuccessToast} from "@/components/common/customToast";

export interface ExerciseModelProps {
    exercise?: IExercise
}

type AccordionItemType = "Main" | "Instances" | "Files" | "Tasks"

export default function ExerciseForm({exercise}: ExerciseModelProps) {
    const type = exercise?.ID ? "Зберегти" : "Створити"
    const {CreateExercise, PendingCreateExercise} = useExercise().useCreateExercise()
    const {UpdateExercise, PendingUpdateExercise} = useExercise().useUpdateExercise()
    const {GetExerciseCategoriesResponse} = useExerciseCategory().useGetExerciseCategories()
    const [openCreateCategoryDialog, setOpenCreateCategoryDialog] = useState(false)
    const router = useRouter()
    const [selectedAccordion, setSelectedAccordion] = useState<AccordionItemType>("Main")

    let values = undefined
    if (exercise) {
        values = {
           ...exercise,
            Data: {
                ...exercise.Data,
                Tasks: Array.from(exercise?.Data.Tasks, (task) => {
                    return {
                        ...task,
                        UseRandomFlag: task.Flags.length === 0,
                        Link: !!task.LinkedInstanceID,
                    }
                }),
            },
        }
    }


    const form = useForm<z.infer<typeof ExerciseSchema>>({
        resolver: zodResolver(ExerciseSchema),
        defaultValues: {
            ...exercise,
            CategoryID: exercise?.CategoryID || "",
            Name: exercise?.Name || "",
            Description: exercise?.Description || "",
            Data: {
                Tasks: !!exercise?.Data.Tasks ? Array.from(exercise?.Data.Tasks, (task) => {
                    return {
                        ...task,
                        UseRandomFlag: task.Flags.length === 0,
                        Link: !!task.LinkedInstanceID,
                    }
                }) : [],
                Instances: exercise?.Data?.Instances || [],
                Files: exercise?.Data?.Files || []
            },
        },
        values: values,
        mode: "all",
        delayError: 500,
    })

    const tasks = useFieldArray({
        control: form.control,
        name: "Data.Tasks",
    })

    const instances = useFieldArray({
        control: form.control,
        name: "Data.Instances",
    })

    const files = useFieldArray({
        control: form.control,
        name: "Data.Files",
    })

    const onSubmit: SubmitHandler<z.infer<typeof ExerciseSchema>> = data => {
        if (type === "Зберегти") {
            UpdateExercise({
                ...data
            }, {
                onSuccess: () => {
                    router.refresh()
                    SuccessToast("Завдання успішно оновлено")
                },
                onError: (error) => {
                    ErrorToast("Не вдалося оновити завдання", {cause: error})
                }
            })
        } else {

            CreateExercise({
                ...data
            }, {
                onSuccess: () => {
                    SuccessToast("Завдання успішно створено")
                    router.push("/exercises")
                },
                onError: (error) => {
                    ErrorToast("Не вдалося створити завдання", {cause: error})
                }
            })
        }
    }

    const onSwitch = (value: AccordionItemType) => {
        if (value === selectedAccordion) return
        if (selectedAccordion === "Main") {
            form.trigger(["Name", "CategoryID"])
        } else {
            form.trigger(`Data.${selectedAccordion}`)
        }
        setSelectedAccordion(value)
    }


    if (typeof window !== "undefined") {
        // prevent page reload on form dirty
        if (form.formState.isDirty && !window.onbeforeunload) {
            window.onbeforeunload = () => true
        }
        // remove page reload on form clean
        if (!form.formState.isDirty && window.onbeforeunload) {
            window.onbeforeunload = null
        }
    }

    let fileUploadProgress = {
        Time: 0,
        Count: 0
    }

    form.watch("Data.Files").forEach((file) => {
        if (file.Progress !== undefined) {
            fileUploadProgress.Count += 1
            fileUploadProgress.Time = file.EstimatedTime! > fileUploadProgress.Time ? file.EstimatedTime! : fileUploadProgress.Time
        }
    })

    return (
        <>
            <BodyHeader title={type === "Створити" ? "Нове завдання" : form.watch("Name")}/>
            <BodyContent>
                <Form {...form}>
                    <FormProvider
                        onSubmit={form.handleSubmit(onSubmit)}
                    >
                        <FormFields>
                            <Accordion type={"single"} collapsible={true} defaultValue={"Main"}
                                       onValueChange={onSwitch}>
                                <AccordionItem value="Main">
                                    <AccordionTrigger
                                        className={cn((form.formState.errors?.Name || form.formState.errors?.CategoryID || form.formState.errors.Description) && "text-destructive", "text-2xl")}>Головне</AccordionTrigger>
                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                        <div className="flex flex-col gap-5 md:flex-row">
                                            <FormField
                                                control={form.control}
                                                name="Name"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Назва завдання</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Назва..." {...field}/>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="CategoryID"
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Категорія</FormLabel>
                                                        <Select onValueChange={(value) => field.onChange(value)}
                                                                defaultValue={field.value.toString()}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue/>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {
                                                                    GetExerciseCategoriesResponse?.Data && GetExerciseCategoriesResponse?.Data.map((category) => {
                                                                        return (
                                                                            <SelectItem
                                                                                key={category.ID!}
                                                                                value={category.ID!}
                                                                            >
                                                                                {category.Name}
                                                                            </SelectItem>)
                                                                    })
                                                                }
                                                                <Button
                                                                    type={"button"}
                                                                    className={"w-full"}
                                                                    onClick={() => setOpenCreateCategoryDialog(true)}
                                                                >
                                                                    Додати категорію
                                                                </Button>
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
                                                        <FormLabel>Опис завдання</FormLabel>
                                                        <FormControl className="h-32">
                                                            <TextEditor {...field}
                                                                        maxCharacters={1000}
                                                                        minCharacters={1}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <FormField
                                    name={"Data.Instances"}
                                    control={form.control}
                                    render={() => (
                                        <FormItem>
                                            <FormControl>
                                                <AccordionItem value="Instances">
                                                    <AccordionTrigger><FormLabel
                                                        className={"text-2xl"}>Інфраструктура</FormLabel></AccordionTrigger>
                                                    <FormMessage/>
                                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                                        <div
                                                            className="flex flex-col w-full">
                                                            <div
                                                                className={"flex flex-col justify-between gap-3"}
                                                            >
                                                                {
                                                                    instances.fields.length ? instances.fields.map((instance, index) => {
                                                                            return (
                                                                                <ExerciseInstanceForm
                                                                                    key={instance.id}
                                                                                    instanceIndex={index}
                                                                                    form={form}
                                                                                    removeInstance={instances.remove}
                                                                                />
                                                                            )
                                                                        })
                                                                        : <div
                                                                            className={"text-gray-400 text-2xl text-center"}>Немає
                                                                            віртуальних машин</div>
                                                                }
                                                                <Button
                                                                    type={"button"}
                                                                    className={"w-full"}
                                                                    onClick={() => {
                                                                        const vmNames = instances.fields.map((instance) => instance.Name)
                                                                        let index = vmNames.length + 1
                                                                        let name = `Віртуальна машина ${index}`
                                                                        while (vmNames?.includes(name)) {
                                                                            index++
                                                                            name = `Віртуальна машина ${index}`
                                                                        }
                                                                        instances.append({
                                                                            ID: self.crypto.randomUUID(),
                                                                            Name: name,
                                                                            Image: "",
                                                                            DNSRecords: [],
                                                                            EnvVars: []
                                                                        }, {
                                                                            shouldFocus: true,
                                                                            focusName: `Data.Instances.${instances.fields.length}.Image`
                                                                        })
                                                                    }}
                                                                >
                                                                    Додати віртуальну машину
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    name={"Data.Files"}
                                    control={form.control}
                                    render={() => (
                                        <FormItem>
                                            <FormControl>
                                                <AccordionItem value="Files">
                                                    <AccordionTrigger><FormLabel
                                                        className={"text-2xl"}>Файли</FormLabel></AccordionTrigger>
                                                    {fileUploadProgress.Count > 0 && (
                                                        <AccordionHeader>
                                                            <div
                                                                className="flex items-center justify-between gap-3 mb-5 short:flex-col short:justify-center short:gap-1">
                                                                <div>Завантаження файлів({fileUploadProgress.Count})
                                                                </div>
                                                                <div>{fileUploadProgress.Time > 0 ? "Залишилось " : ""}{Math.floor(fileUploadProgress.Time / 3600) > 0 ? Math.floor(fileUploadProgress.Time / 3600) + " год. " : ""}{Math.floor(fileUploadProgress.Time / 60) % 60 > 0 ? Math.floor(fileUploadProgress.Time / 60) % 60 + " хв. " : ""}{fileUploadProgress.Time % 60 > 0 ? fileUploadProgress.Time % 60 + " сек." : ""}</div>
                                                            </div>
                                                        </AccordionHeader>
                                                    )}
                                                    <FormMessage/>
                                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                                        <div
                                                            className="flex flex-col w-full">
                                                            <div
                                                                className={"flex flex-col justify-between gap-3"}
                                                            >
                                                                {
                                                                    files.fields.length ? files.fields.map((file, index) => {
                                                                            return (
                                                                                <ExerciseFileForm
                                                                                    key={file.ID}
                                                                                    fileIndex={index}
                                                                                    form={form}
                                                                                    removeFile={files.remove}
                                                                                />
                                                                            )
                                                                        })
                                                                        : <div
                                                                            className={"text-gray-400 text-2xl text-center"}>Немає
                                                                            файлів</div>
                                                                }
                                                                <AddExerciseFileButton
                                                                    addFile={files.append}
                                                                    nextIndex={files.fields.length}
                                                                />
                                                            </div>

                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    name={"Data.Tasks"}
                                    control={form.control}
                                    render={() => (
                                        <FormItem>
                                            <FormControl>
                                                <AccordionItem value="Tasks">
                                                    <AccordionTrigger><FormLabel
                                                        className={"text-2xl"}>Задачі</FormLabel></AccordionTrigger>
                                                    <FormMessage/>
                                                    <AccordionContent className={"mx-5 flex-col flex gap-6"}>
                                                        <div
                                                            className="flex flex-col w-full">
                                                            <div
                                                                className={"flex flex-col justify-between gap-3"}
                                                            >
                                                                {
                                                                    tasks.fields.length ? tasks.fields.map((task, index) => {
                                                                            return (
                                                                                <ExerciseTaskForm
                                                                                    key={task.id}
                                                                                    taskIndex={index}
                                                                                    form={form}
                                                                                    removeTask={tasks.remove}
                                                                                />
                                                                            )
                                                                        }) :
                                                                        <div
                                                                            className={"text-gray-400 text-2xl text-center"}>
                                                                            Немає задач
                                                                        </div>
                                                                }
                                                                <Button
                                                                    type={"button"}
                                                                    className={"w-full"}
                                                                    onClick={() => {
                                                                        tasks.append({
                                                                            ID: self.crypto.randomUUID(),
                                                                            Name: "",
                                                                            Description: "",
                                                                            Points: 100,
                                                                            UseRandomFlag: false,
                                                                            Flags: [],
                                                                            Link: false,
                                                                            AttachedFileIDs: []
                                                                        }, {
                                                                            shouldFocus: true,
                                                                            focusName: `Data.Tasks.${tasks.fields.length}.Name`
                                                                        })
                                                                    }}
                                                                >
                                                                    Додати задачу
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </Accordion>
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
                                {(PendingCreateExercise || PendingUpdateExercise) ? (
                                    'Опрацювання...'
                                ) : `${type}`}
                            </Button>
                            <Button
                                type="reset"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                                onClick={() => router.push("/exercises")}
                            >
                                Відмінити
                            </Button>
                        </FormButtons>
                    </FormProvider>
                </Form>
                <DialogForm isOpen={openCreateCategoryDialog} onClose={() => setOpenCreateCategoryDialog(false)}>
                    <ExerciseCategoryForm onClose={() => setOpenCreateCategoryDialog(false)}/>
                </DialogForm>
            </BodyContent>
        </>
    )
}