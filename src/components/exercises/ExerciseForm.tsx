"use client"
import {SubmitHandler, useFieldArray, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Button} from "@/components/ui/button";
import "react-datepicker/dist/react-datepicker.css";
import {useRouter} from "next/navigation";
import {BodyContent, BodyHeader} from "@/components/common/page";
import {FormButtons, FormFields, FormProvider} from "@/components/common/form";
import {Exercise, ExerciseSchema} from "@/types/exercise";
import {useExercise} from "@/hooks/useExercise";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import {useEffect, useState} from "react";
import CreateCategoryDialog from "@/components/exercises/CreateCategoryDialog";
import ExerciseTaskForm from "@/components/exercises/ExerciseTaskForm";
import ExerciseInstanceForm from "@/components/exercises/ExerciseInstanceForm";

export interface ExerciseModelProps {
    type: "Створити" | "Зберегти"
    exercise?: Exercise
}

export default function ExerciseForm({type, exercise}: ExerciseModelProps) {
    const createExercise = useExercise().useCreateExercise()
    const updateExercise = useExercise().useUpdateExercise()
    const getExerciseCategories = useExerciseCategory().useGetExerciseCategories()
    const [openCreateCategoryDialog, setOpenCreateCategoryDialog] = useState(false)
    const router = useRouter()

    const form = useForm<z.infer<typeof ExerciseSchema>>({
        resolver: zodResolver(ExerciseSchema),
        defaultValues: {
            CategoryID: exercise?.CategoryID || "",
            Name: exercise?.Name || "",
            Description: exercise?.Description || "",
            Tasks: exercise?.Data?.Tasks || [],
            Instances: exercise?.Data?.Instances || []
        },
        mode: type === "Зберегти" ? "onBlur" : "onChange"
    })

    const tasks = useFieldArray({
        control: form.control,
        name: "Tasks",
    })

    const instances = useFieldArray({
        control: form.control,
        name: "Instances",
    })

    const onSubmit: SubmitHandler<z.infer<typeof ExerciseSchema>> = data => {
        if (type === "Зберегти") {
            updateExercise.mutate({
                ...data, Data: {
                    Tasks: data.Tasks,
                    Instances: data.Instances || [],
                }, ID: exercise?.ID
            })
        } else {
            createExercise.mutate({
                ...data, Data: {
                    Tasks: data.Tasks,
                    Instances: data.Instances || [],
                }
            })
        }
    }

    useEffect(() => {
        if (createExercise.isSuccess || updateExercise.isSuccess) {
            router.push("/exercises")
        }
    }, [createExercise.isSuccess, updateExercise.isSuccess])

    return (
        <>
            <BodyHeader title={type === "Створити" ? "Нове завдання" : form.watch("Name")}/>
            <BodyContent>
                <Form {...form}>
                    <FormProvider
                        onSubmit={form.handleSubmit(onSubmit)}
                    >
                        <FormFields>
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
                                                        getExerciseCategories.data && getExerciseCategories.data?.map((category) => {
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
                                                <Textarea placeholder="Опис..." {...field}
                                                          className="textarea rounded-2xl"/>
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col gap-5 md:grid md:grid-cols-12">
                                <div
                                    className="flex flex-col gap-5 md:col-start-1 md:col-end-6"
                                ><FormField
                                    control={form.control}
                                    name="Instances"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Віртуальні машини</FormLabel>
                                            <FormControl>
                                                <div
                                                    className={"flex flex-col justify-between gap-3"}
                                                >
                                                    {
                                                        instances.fields.map((instance, index) => {
                                                            return (
                                                                <ExerciseInstanceForm
                                                                    key={instance.id}
                                                                    instanceIndex={index}
                                                                    form={form}
                                                                    removeInstance={instances.remove}
                                                                />
                                                            )
                                                        })
                                                    }
                                                    <Button
                                                        type={"button"}
                                                        className={"w-full"}
                                                        onClick={() => {
                                                            instances.append({
                                                                ID: self.crypto.randomUUID(),
                                                                Name: `Віртуальна машина ${tasks.fields.length + 1}`,
                                                                Image: "",
                                                                DNSRecords: [],
                                                                EnvVars: []
                                                            })
                                                        }}
                                                    >
                                                        Додати віртуальну машину
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>)}
                                />
                                </div>
                                <div
                                    className="flex flex-col gap-5 md:col-start-6 md:col-end-13"
                                >
                                    <FormItem>
                                        <FormLabel>Підзавдання</FormLabel>
                                        <FormControl>
                                            <div
                                                className={"flex flex-col justify-between gap-3"}
                                            >
                                                {
                                                    tasks.fields.map((task, index) => {
                                                        return (
                                                            <ExerciseTaskForm
                                                                key={task.id}
                                                                taskIndex={index}
                                                                form={form}
                                                                removeTask={tasks.remove}
                                                            />
                                                        )
                                                    })
                                                }
                                                <Button
                                                    type={"button"}
                                                    className={"w-full"}
                                                    onClick={() => {
                                                        tasks.append({
                                                            ID: self.crypto.randomUUID(),
                                                            Name: `Підзавдання ${tasks.fields.length + 1}`,
                                                            Description: "",
                                                            Points: 100,
                                                            UseRandomFlag: true,
                                                            Flags: [],
                                                            Link: false,
                                                            LinkedInstanceID: "",
                                                            InstanceFlagVar: ""
                                                        })
                                                    }}
                                                >
                                                    Додати підзавдання
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage/>
                                    </FormItem>

                                </div>
                            </div>
                        </FormFields>
                        <FormButtons>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                            >
                                {(createExercise.isPending || updateExercise.isPending) ? (
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
                <CreateCategoryDialog isOpen={openCreateCategoryDialog}
                                      onClose={() => setOpenCreateCategoryDialog(false)}/>
            </BodyContent>
        </>
    )
}