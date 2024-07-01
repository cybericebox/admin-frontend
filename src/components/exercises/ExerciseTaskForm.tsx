import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {useFieldArray, UseFieldArrayRemove, UseFormReturn} from "react-hook-form";
import * as z from "zod";
import {ExerciseSchema} from "@/types/exercise";
import {DeleteIcon} from "@/components/common/delete";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Switch} from "@/components/ui/switch";
import {Button} from "@/components/ui/button";

interface ExerciseTaskFormProps {
    taskIndex: number;
    form: UseFormReturn<z.infer<typeof ExerciseSchema>>
    removeTask: UseFieldArrayRemove
}

export default function ExerciseTaskForm({taskIndex, form, removeTask}: ExerciseTaskFormProps) {
    const flags = useFieldArray({
        name: `Tasks.${taskIndex}.Flags` as "Tasks.0.Flags",
    })

    return (<>
            <div
                className={"w-full h-full flex flex-col gap-3 rounded-lg border-2 p-3"}
            >
                <div
                    className={"w-full h-full flex flex-col gap-5"}
                >

                    <FormField
                        control={form.control}
                        name={`Tasks.${taskIndex}.Name`}
                        render={({field}) => (
                            <FormItem className="w-full">
                                <div
                                    className={"flex justify-between"}
                                >
                                    <FormLabel>Назва</FormLabel>
                                    <DeleteIcon
                                        title={"Видалити підзавдання"}
                                        onClick={() => {
                                            removeTask(taskIndex)
                                        }}/>
                                </div>

                                <FormControl>
                                    <Input placeholder="Назва..." {...field}/>
                                </FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`Tasks.${taskIndex}.Description`}
                        render={({field}) => (
                            <FormItem className="w-full">
                                <FormLabel>Опис підзавдання</FormLabel>
                                <FormControl className="h-28">
                                    <Textarea placeholder="Опис..."
                                              {...field}
                                              className="textarea rounded-2xl"/>
                                </FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`Tasks.${taskIndex}.Points`}
                        render={({field}) => (
                            <FormItem className="w-full">
                                <FormLabel>Бали</FormLabel>
                                <FormControl>
                                    <Input {...field}
                                           onChange={(event) => {
                                               field.onChange(Number(event.target.value))
                                           }
                                           }
                                           min={1}
                                           value={field.value.toString()}
                                           type={"number"}/>
                                </FormControl>
                                <FormMessage/>
                            </FormItem>
                        )}
                    />
                    <div className="flex flex-col gap-3 w-full">
                        <FormField
                            control={form.control}
                            name={`Tasks.${taskIndex}.UseRandomFlag`}
                            render={({field}) => (
                                <FormItem className="flex flex-row items-center h-5">
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className={"h-5 mr-2"}
                                        />
                                    </FormControl>
                                    <FormLabel
                                        className={"h-full"}
                                    >
                                        Формувати випадковий прапор</FormLabel>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                        {!form.watch(`Tasks.${taskIndex}.UseRandomFlag`) && (
                            <div className="flex flex-col gap-3 w-full">
                                <div
                                    className={"mt-4"}
                                >
                                    <FormLabel>Прапори</FormLabel>
                                </div>
                                <div
                                    className={"w-full h-full flex flex-col gap-3"}
                                >
                                    {
                                        flags.fields.map((flag, index) => {
                                            return (
                                                <FormField
                                                    key={flag.id}
                                                    control={form.control}
                                                    name={`Tasks.${taskIndex}.Flags.${index}`}
                                                    render={({field}) => (
                                                        <FormItem className="w-full">
                                                            <FormControl>
                                                                <div
                                                                    className={"flex justify-between items-center"}>
                                                                    <Input placeholder="Прапор..." {...field}/>
                                                                    <DeleteIcon
                                                                        title={"Видалити прапор"}
                                                                        onClick={() => {
                                                                            flags.remove(index)
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
                                            flags.append(`Прапор ${flags.fields.length + 1}`)
                                        }}
                                    >
                                        Додати прапор
                                    </Button>
                                </div>

                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-5 w-full">
                        <FormField
                            control={form.control}
                            name={`Tasks.${taskIndex}.Link`}
                            render={({field}) => (
                                <FormItem className="flex flex-row items-center h-5">
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className={"h-5 mr-2"}
                                        />
                                    </FormControl>
                                    <FormLabel
                                        className={"h-full"}
                                    >Зв`язати з віртуальною машиною</FormLabel>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                        {form.watch(`Tasks.${taskIndex}.Link`) && (
                            <div className="flex flex-col gap-5 md:flex-row w-full">
                                <FormField
                                    control={form.control}
                                    name={`Tasks.${taskIndex}.LinkedInstanceID`}
                                    render={({field}) => (
                                        <FormItem className="w-full">
                                            <FormLabel>Віртуальна машина</FormLabel>
                                            <Select onValueChange={(value) => field.onChange(value)}
                                                    defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {
                                                        form.watch("Instances")?.map((instance) => {
                                                            return (
                                                                <SelectItem
                                                                    key={instance.ID}
                                                                    value={instance.ID}
                                                                >
                                                                    {instance.Name}
                                                                </SelectItem>)
                                                        })
                                                    }
                                                </SelectContent>

                                            </Select>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`Tasks.${taskIndex}.InstanceFlagVar`}
                                    render={({field}) => (
                                        <FormItem className="w-full">
                                            <FormLabel>Змінна середи для прапору</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Змінна для збереження прапору..." {...field}/>
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>

    )
}