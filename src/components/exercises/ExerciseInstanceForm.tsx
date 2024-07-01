import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {useFieldArray, UseFieldArrayRemove, UseFormReturn} from "react-hook-form";
import * as z from "zod";
import {ExerciseSchema} from "@/types/exercise";
import {Button} from "@/components/ui/button";
import {DeleteIcon} from "@/components/common/delete";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

interface ExerciseInstanceFormProps {
    instanceIndex: number;
    form: UseFormReturn<z.infer<typeof ExerciseSchema>>
    removeInstance: UseFieldArrayRemove
}

export default function ExerciseInstanceForm({instanceIndex, form, removeInstance}: ExerciseInstanceFormProps) {
    const envVars = useFieldArray({
        name: `Instances.${instanceIndex}.EnvVars` as "Instances.0.EnvVars"
    })

    const dnsRecords = useFieldArray({
        name: `Instances.${instanceIndex}.DNSRecords` as "Instances.0.DNSRecords"
    })

    return (
        <div
            className={"w-full h-full flex flex-col gap-3 rounded-lg border-2 p-3"}
        >
            <div
                className={"w-full h-full flex flex-col gap-3"}
            >

                <FormField
                    control={form.control}
                    name={`Instances.${instanceIndex}.Name`}
                    render={({field}) => (
                        <FormItem className="w-full">
                            <div
                                className={"flex justify-between"}
                            >
                                <FormLabel>Назва</FormLabel>
                                <DeleteIcon
                                    title={"Видалити віртуальну машину"}
                                    onClick={() => {
                                        removeInstance(instanceIndex)
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
                    name={`Instances.${instanceIndex}.Image`}
                    render={({field}) => (
                        <FormItem className="w-full">
                            <FormLabel>Образ Docker</FormLabel>
                            <FormControl>
                                <Input placeholder="Посилання на образ Docker..." {...field}/>
                            </FormControl>
                            <FormMessage/>
                        </FormItem>
                    )}
                />
            </div>

            <div
                className={"w-full h-full flex flex-col gap-3"}
            >
                <div
                    className={"mt-4"}
                >
                    <FormLabel>Записи DNS</FormLabel>
                </div>
                <div
                    className={"w-full h-full flex flex-col gap-3"}
                >
                    {
                        dnsRecords.fields.map((record, index) => {
                            return (
                                <div
                                    key={record.id}
                                    className={"grid grid-cols-7 gap-3 items-center border rounded-lg p-2"}
                                >
                                    <div
                                        className={"col-start-1 col-end-7 flex flex-col gap-3 justify-between items-center"}
                                    >
                                        <FormField
                                            control={form.control}
                                            name={`Instances.${instanceIndex}.DNSRecords.${index}.Type`}
                                            render={({field}) => (
                                                <FormItem className="w-full">
                                                    <FormControl>
                                                        <Select
                                                            onValueChange={(value) => field.onChange(value)}
                                                            defaultValue={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue
                                                                        placeholder="Тип..."
                                                                    />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem key={"A"} value={"A"}>{"A"}</SelectItem>
                                                                <SelectItem key={"AAAA"}
                                                                            value={"AAAA"}>{"AAAA"}</SelectItem>
                                                                <SelectItem key={"CNAME"}
                                                                            value={"CNAME"}>{"CNAME"}</SelectItem>
                                                                <SelectItem key={"MX"} value={"MX"}>{"MX"}</SelectItem>
                                                                <SelectItem key={"TXT"}
                                                                            value={"TXT"}>{"TXT"}</SelectItem>
                                                            </SelectContent>

                                                        </Select>
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`Instances.${instanceIndex}.DNSRecords.${index}.Name`}
                                            render={({field}) => (
                                                <FormItem className="w-full">
                                                    <FormControl>
                                                        <Input placeholder="Назва..." {...field}/>
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                        {!(form.watch(`Instances.${instanceIndex}.DNSRecords.${index}.Type`).startsWith("A")) &&

                                            <FormField
                                                control={form.control}
                                                name={`Instances.${instanceIndex}.DNSRecords.${index}.Value`}
                                                render={({field}) => (
                                                    <FormItem className="w-full">
                                                        <FormControl>
                                                            <Input placeholder="Значення..." {...field}/>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />}
                                    </div>
                                    <DeleteIcon
                                        title={"Видалити запис"}
                                        onClick={() => {
                                            dnsRecords.remove(index)
                                        }}/>
                                </div>
                            )
                        })
                    }
                    <Button
                        type={"button"}
                        onClick={() => {
                            dnsRecords.append({
                                Type: "",
                                Name: "",
                                Value: ""
                            })
                        }}
                    >
                        Додати запис DNS
                    </Button>
                </div>

            </div>
            <div
                className={"w-full h-full flex flex-col gap-3"}
            >
                <div
                    className={"mt-4"}
                >
                    <FormLabel> Змінні середи</FormLabel>
                </div>
                <div
                    className={"w-full h-full flex flex-col gap-3"}
                >
                    {
                        envVars.fields.map((envVar, index) => {
                            return (
                                <div
                                    key={envVar.id}
                                    className={"grid grid-cols-7 gap-3 items-center border rounded-lg p-2"}
                                >
                                    <div
                                        className={"col-start-1 col-end-7 flex flex-col gap-3 justify-between items-center"}
                                    >
                                        <FormField
                                            control={form.control}
                                            name={`Instances.${instanceIndex}.EnvVars.${index}.Name`}
                                            render={({field}) => (
                                                <FormItem className="w-full">
                                                    <FormControl>
                                                        <Input placeholder="Назва..." {...field}/>
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`Instances.${instanceIndex}.EnvVars.${index}.Value`}
                                            render={({field}) => (
                                                <FormItem className="w-full">
                                                    <FormControl>
                                                        <Input placeholder="Значення..." {...field}/>
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <DeleteIcon
                                        title={"Видалити змінну середи"}
                                        onClick={() => {
                                            envVars.remove(index)
                                        }}/>
                                </div>
                            )
                        })
                    }
                    <Button
                        type={"button"}
                        onClick={() => {
                            envVars.append({
                                Name: "",
                                Value: ""
                            })
                        }}
                    >
                        Додати змінну середи
                    </Button>
                </div>

            </div>
        </div>
    )
}