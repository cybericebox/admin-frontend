import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {useFieldArray, UseFieldArrayRemove, UseFormReturn} from "react-hook-form";
import * as z from "zod";
import {ExerciseSchema} from "@/types/exercise";
import {DeleteIcon} from "@/components/common/delete";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Button} from "@/components/ui/button";
import {cn} from "@/utils/cn";
import {Switch} from "@/components/ui/switch";
import TextEditor from "@/components/common/editor";

interface ExerciseTaskFormProps {
    taskIndex: number;
    form: UseFormReturn<z.infer<typeof ExerciseSchema>>
    removeTask: UseFieldArrayRemove
}

export default function ExerciseTaskForm({taskIndex, form, removeTask}: ExerciseTaskFormProps) {
    const flags = useFieldArray({
        name: `Data.Tasks.${taskIndex}.Flags` as "Data.Tasks.0.Flags",

    })

    const attachedFileIDs = useFieldArray({
        name: `Data.Tasks.${taskIndex}.AttachedFileIDs` as "Data.Tasks.0.AttachedFileIDs",
    })

    // // if the random flag is used, remove the flags
    if (form.watch(`Data.Tasks.${taskIndex}.UseRandomFlag`) &&
        (flags.fields.length > 0 || form.formState.errors.Data?.Tasks?.[taskIndex]?.Flags)) {
        form.setValue(`Data.Tasks.${taskIndex}.Flags`, [])
        form.clearErrors(`Data.Tasks.${taskIndex}.Flags`)
    }

    // if the link is not used, remove the linked instance id and the instance flag var
    if (!form.watch(`Data.Tasks.${taskIndex}.Link`) &&
        (form.watch(`Data.Tasks.${taskIndex}.LinkedInstanceID`)
            || form.watch(`Data.Tasks.${taskIndex}.InstanceFlagVar`)
            || form.formState.errors.Data?.Tasks?.[taskIndex]?.LinkedInstanceID
            || form.formState.errors.Data?.Tasks?.[taskIndex]?.InstanceFlagVar)) {
        form.setValue(`Data.Tasks.${taskIndex}.LinkedInstanceID`, "")
        form.setValue(`Data.Tasks.${taskIndex}.InstanceFlagVar`, "")
        form.clearErrors(`Data.Tasks.${taskIndex}.LinkedInstanceID`)
        form.clearErrors(`Data.Tasks.${taskIndex}.InstanceFlagVar`)
    }

    // if the random flag is used, link must be used
    if (form.watch(`Data.Tasks.${taskIndex}.UseRandomFlag`) && !form.watch(`Data.Tasks.${taskIndex}.Link`)) {
        form.setValue(`Data.Tasks.${taskIndex}.Link`, true)
    }

    return (<div
            className={cn("w-full h-full flex flex-col gap-3 rounded-lg border-2 p-3 relative", form.formState.errors.Data?.Tasks?.[taskIndex] && "border-destructive")}
        >
            <DeleteIcon
                title={"Видалити задачу"}
                onClick={() => {
                    removeTask(taskIndex)
                }}
                className={"absolute top-2 right-2"}
            />
            <div>
                <FormField
                    control={form.control}
                    name={`Data.Tasks.${taskIndex}.Name`}
                    render={({field}) => (
                        <FormItem className="w-full">
                            <FormLabel>Назва</FormLabel>
                            <FormControl>
                                <Input placeholder="Назва..." {...field}/>
                            </FormControl>
                            <FormMessage/>
                        </FormItem>
                    )}
                />
            </div>
            <div className={"flex flex-col lg:flex-row-reverse gap-5"}>
                <div className={"flex flex-col lg:w-2/3"}>
                    <FormField
                        control={form.control}
                        name={`Data.Tasks.${taskIndex}.Description`}
                        render={({field}) => (
                            <FormItem className="w-full">
                                <FormLabel>Опис задачі</FormLabel>
                                <FormControl className="h-24">
                                    <TextEditor
                                        {...field}
                                        minCharacters={1}
                                        maxCharacters={1000}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        name={`Data.Tasks.${taskIndex}.AttachedFileIDs`}
                        control={form.control}
                        render={() => (
                            <FormItem>
                                <FormControl>
                                    <>
                                        <div className={"mt-4"}>
                                            <FormLabel>Прикріплені файли</FormLabel>
                                        </div>
                                        <FormMessage/>
                                        <div className={"w-full h-full flex flex-col gap-3"}>
                                            {
                                                attachedFileIDs.fields.map((attachedFileID, index) => {
                                                    return (

                                                        <FormField
                                                            key={attachedFileID.id}
                                                            control={form.control}
                                                            name={`Data.Tasks.${taskIndex}.AttachedFileIDs.${index}`}
                                                            render={({field}) => (
                                                                <FormItem className="w-full">
                                                                    <FormControl>
                                                                        <div
                                                                            className={"flex justify-between items-center gap-1"}>
                                                                            <Select
                                                                                name={`Data.Tasks.${taskIndex}.AttachedFileIDs.${index}`}
                                                                                onValueChange={(value) => field.onChange(value)}
                                                                                defaultValue={field.value}>
                                                                                <FormControl>
                                                                                    <SelectTrigger>
                                                                                        <SelectValue/>
                                                                                    </SelectTrigger>
                                                                                </FormControl>
                                                                                <SelectContent>
                                                                                    {
                                                                                        form.watch("Data.Files")?.map((files) => {
                                                                                            return (
                                                                                                <SelectItem
                                                                                                    key={files.ID}
                                                                                                    value={files.ID}
                                                                                                >
                                                                                                    {files.Name}
                                                                                                </SelectItem>)
                                                                                        })
                                                                                    }
                                                                                </SelectContent>

                                                                            </Select>
                                                                            <DeleteIcon
                                                                                title={"Відкріпити файл"}
                                                                                onClick={() => {
                                                                                    attachedFileIDs.remove(index)
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
                                                    attachedFileIDs.append("", {
                                                        shouldFocus: true,
                                                        focusName: `Data.Tasks.${taskIndex}.AttachedFileIDs.${flags.fields.length}`
                                                    })
                                                }}
                                            >
                                                Прикріпити файл
                                            </Button>
                                        </div>
                                    </>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
                <div className={"flex flex-col gap-5 lg:w-1/3"}>
                    <FormField
                        control={form.control}
                        name={`Data.Tasks.${taskIndex}.Points`}
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
                    <FormField
                        name={`Data.Tasks.${taskIndex}.Flags`}
                        control={form.control}
                        render={() => (
                            <FormItem>
                                <FormControl>
                                    <div className={"flex flex-col gap-5"}>
                                        <FormLabel>Прапори</FormLabel>
                                        <FormField
                                            control={form.control}
                                            name={`Data.Tasks.${taskIndex}.UseRandomFlag`}
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
                                        {!form.watch(`Data.Tasks.${taskIndex}.UseRandomFlag`) && (
                                            <div className={"w-full h-full flex flex-col gap-3"}>
                                                {

                                                    flags.fields.map((flag, index) => {
                                                        return (

                                                            <FormField
                                                                key={flag.id}
                                                                control={form.control}
                                                                name={`Data.Tasks.${taskIndex}.Flags.${index}`}
                                                                render={({field}) => (
                                                                    <FormItem className="w-full">
                                                                        <FormControl>
                                                                            <div
                                                                                className={"flex justify-between items-center gap-1"}>
                                                                                <Input
                                                                                    placeholder="Прапор..." {...field} />
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
                                                <FormMessage/>
                                                <Button
                                                    type={"button"}
                                                    onClick={() => {
                                                        flags.append("", {
                                                            shouldFocus: true,
                                                            focusName: `Data.Tasks.${taskIndex}.Flags.${flags.fields.length}`
                                                        })
                                                    }}
                                                >
                                                    Додати прапор
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

            </div>
            <FormField
                control={form.control}
                name={`Data.Tasks.${taskIndex}.Link`}
                render={({field}) => (
                    <FormItem className="flex flex-row items-center h-5">
                        <FormControl>
                            <Switch
                                disabled={form.watch(`Data.Tasks.${taskIndex}.UseRandomFlag`)}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className={"h-5 mr-2"}
                                data-tooltip-id={"tooltip"}
                                data-tooltip-content={"Випадковий прапор вимагає зв'язку з інфраструктурою"}
                                data-tooltip-hidden={!form.watch(`Data.Tasks.${taskIndex}.UseRandomFlag`)}
                            />
                        </FormControl>
                        <FormLabel
                            className={"h-full"}
                        >
                            Зв`язати з інфраструктурою
                        </FormLabel>
                        <FormMessage/>
                    </FormItem>
                )}/>
            {form.watch(`Data.Tasks.${taskIndex}.Link`) && (
                <div className="flex flex-col gap-5 lg:flex-row w-full">
                    <FormField
                        control={form.control}
                        name={`Data.Tasks.${taskIndex}.LinkedInstanceID`}
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
                                            form.watch("Data.Instances")?.map((instance) => {
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
                        name={`Data.Tasks.${taskIndex}.InstanceFlagVar`}
                        render={({field}) => (
                            <FormItem className="w-full">
                                <FormLabel>Змінна оточення для збереження прапору</FormLabel>
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
    )
}