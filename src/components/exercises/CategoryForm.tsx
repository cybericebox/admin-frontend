"use client"
import {SubmitHandler, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Button} from "@/components/ui/button";
import "react-datepicker/dist/react-datepicker.css";
import {BodyHeader} from "@/components/common/page";
import {ExerciseCategory, ExerciseCategorySchema} from "@/types/exercise";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {useExerciseCategory} from "@/hooks/useExerciseCategory";

export interface ExerciseCategoryFormProps {
    type: "Створити" | "Зберегти"
    category?: ExerciseCategory
    onCancel?: () => void
}

export default function ExerciseCategoryForm({type, category, onCancel}: ExerciseCategoryFormProps) {
    const createCategory = useExerciseCategory().useCreateExerciseCategory()
    const updateCategory = useExerciseCategory().useUpdateExerciseCategory()

    const form = useForm<z.infer<typeof ExerciseCategorySchema>>({
        resolver: zodResolver(ExerciseCategorySchema),
        defaultValues: {
            Name: category?.Name || "",
            Description: category?.Description || "",
        },
        mode: type === "Зберегти" ? "onBlur" : "onChange"
    })

    const onSubmit: SubmitHandler<z.infer<typeof ExerciseCategorySchema>> = data => {
        if (type === "Зберегти") {
            updateCategory.mutate({...data, ID: category?.ID})
            onCancel && onCancel()
        } else {
            createCategory.mutate(data)
            onCancel && onCancel()
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
                                {(createCategory.isPending || updateCategory.isPending) ? (
                                    'Опрацювання...'
                                ) : `${type}`}
                            </Button>
                            <Button
                                type="reset"
                                size="lg"
                                disabled={form.formState.isSubmitting}
                                className="max-w-[400px]"
                                onClick={onCancel}
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