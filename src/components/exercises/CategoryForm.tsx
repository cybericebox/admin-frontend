"use client"
import {SubmitHandler, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Button} from "@/components/ui/button";
import {BodyHeader} from "@/components/common/page";
import {ExerciseCategorySchema, IExerciseCategory} from "@/types/exercise";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";
import toast from "react-hot-toast";
import {IErrorResponse} from "@/types/api";
import {ErrorToast} from "@/components/common/errorToast";

export interface ExerciseCategoryFormProps {
    category?: IExerciseCategory
    onClose: () => void
}

export default function ExerciseCategoryForm({category, ...props}: ExerciseCategoryFormProps) {
    const type = category?.ID ? "Зберегти" : "Створити"
    const {CreateExerciseCategory, PendingCreateExerciseCategory} = useExerciseCategory().useCreateExerciseCategory()
    const {UpdateExerciseCategory, PendingUpdateExerciseCategory} = useExerciseCategory().useUpdateExerciseCategory()

    const form = useForm<z.infer<typeof ExerciseCategorySchema>>({
        resolver: zodResolver(ExerciseCategorySchema),
        defaultValues: {
            Name: category?.Name || "",
            Description: category?.Description || "",
        },
        mode: "all"
    })

    const onSubmit: SubmitHandler<z.infer<typeof ExerciseCategorySchema>> = data => {
        if (type === "Зберегти") {
            UpdateExerciseCategory({...data, ID: category?.ID}, {
                onSuccess: () => {
                    props.onClose()
                    toast.success("Категорію успішно оновлено")
                },
                onError: (error) => {
                    const e = error as IErrorResponse
                    ErrorToast({message: "Не вдалося оновити категорію", error: e})
                }
            })
        } else {
            CreateExerciseCategory(data, {
                onSuccess: () => {
                    props.onClose()
                    toast.success("Категорію успішно створено")
                },
                onError: (error) => {
                    const e = error as IErrorResponse
                    ErrorToast({message: "Не вдалося створити категорію", error: e})
                }
            })
        }
    }

    return (
        <>
            <BodyHeader title={type === "Створити" ? "Нова категорія" : form.watch("Name")}/>
            <div>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex flex-col gap-3"
                    >

                        <div className="flex flex-col gap-5 md:flex-row w-full">
                            <FormField
                                control={form.control}
                                name="Name"
                                render={({field}) => (
                                    <FormItem className="w-full">
                                        <FormLabel>Назва категорії</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Назва..." {...field}/>
                                        </FormControl>
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
                                        <FormControl className="h-44">
                                            <Textarea placeholder="Опис..." {...field}
                                                      className="textarea rounded-2xl"/>
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
                                {(PendingCreateExerciseCategory || PendingUpdateExerciseCategory) ? (
                                    'Опрацювання...'
                                ) : `${type}`}
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