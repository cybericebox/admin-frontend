import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {useFieldArray, UseFieldArrayRemove, UseFormReturn} from "react-hook-form";
import * as z from "zod";
import {ExerciseSchema} from "@/types/exercise";
import {Button} from "@/components/ui/button";
import {DeleteIcon} from "@/components/common/delete";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {cn} from "@/utils/cn";

interface ExerciseInstanceFormProps {
    instanceIndex: number;
    form: UseFormReturn<z.infer<typeof ExerciseSchema>>
    removeInstance: UseFieldArrayRemove
}

export default function ExerciseInstanceForm({instanceIndex, form, removeInstance}: ExerciseInstanceFormProps) {
    const envVars = useFieldArray({
        name: `Data.Instances.${instanceIndex}.EnvVars` as "Data.Instances.0.EnvVars"
    })

    const dnsRecords = useFieldArray({
        name: `Data.Instances.${instanceIndex}.DNSRecords` as "Data.Instances.0.DNSRecords"
    })

    return (
        <div
            className={cn("flex flex-col gap-5 rounded-lg border-2 p-3 relative", form.formState.errors.Data?.Instances?.[instanceIndex] && "border-destructive")}
        >
            <DeleteIcon
                title={"Видалити віртуальну машину"}
                className={"absolute top-2 right-2"}
                onClick={() => {
                    removeInstance(instanceIndex)
                }}/>
            <div className="flex flex-col gap-5 md:flex-row w-full">
                <FormField
                    control={form.control}
                    name={`Data.Instances.${instanceIndex}.Name`}
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
                <FormField
                    control={form.control}
                    name={`Data.Instances.${instanceIndex}.Image`}
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
            <div className="flex flex-col gap-5 md:flex-row w-full relative">
                <FormField
                    name={`Data.Instances.${instanceIndex}.DNSRecords`}
                    control={form.control}
                    render={() => (
                        <FormItem className={"w-full"}>
                            <FormControl className={"w-full"}>
                                <>
                                    <FormLabel>Записи DNS</FormLabel>
                                    <FormMessage/>
                                    <div className={"flex flex-col gap-3"}>
                                        {
                                            dnsRecords.fields.map((record, index) => {
                                                return (
                                                    <div
                                                        key={record.id}
                                                        className={cn("flex flex-col gap-2 items-center border rounded-lg p-3 relative", form.formState.errors.Data?.Instances?.[instanceIndex]?.DNSRecords?.[index] && "border-destructive")}
                                                    >
                                                        <FormField
                                                            control={form.control}
                                                            name={`Data.Instances.${instanceIndex}.DNSRecords.${index}.Type`}
                                                            render={({field}) => (
                                                                <FormItem className="w-full">
                                                                    <FormLabel>Тип запису</FormLabel>
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
                                                                                <SelectItem key={"A"}
                                                                                            value={"A"}>{"A"}</SelectItem>
                                                                                <SelectItem key={"AAAA"}
                                                                                            value={"AAAA"}>{"AAAA"}</SelectItem>
                                                                                <SelectItem key={"CNAME"}
                                                                                            value={"CNAME"}>{"CNAME"}</SelectItem>
                                                                                <SelectItem key={"MX"}
                                                                                            value={"MX"}>{"MX"}</SelectItem>
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
                                                            name={`Data.Instances.${instanceIndex}.DNSRecords.${index}.Name`}
                                                            render={({field}) => (
                                                                <FormItem className="w-full">
                                                                    <FormLabel>Назва запису</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="Назва..." {...field}/>
                                                                    </FormControl>
                                                                    <FormMessage/>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        {!(form.watch(`Data.Instances.${instanceIndex}.DNSRecords.${index}.Type`).startsWith("A")) &&

                                                            <FormField
                                                                control={form.control}
                                                                name={`Data.Instances.${instanceIndex}.DNSRecords.${index}.Value`}
                                                                render={({field}) => (
                                                                    <FormItem className="w-full">
                                                                        <FormLabel>Значення запису</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                placeholder="Значення..." {...field}/>
                                                                        </FormControl>
                                                                        <FormMessage/>
                                                                    </FormItem>
                                                                )}
                                                            />}
                                                        <DeleteIcon
                                                            title={"Видалити запис"}
                                                            onClick={() => {
                                                                dnsRecords.remove(index)
                                                            }}
                                                            className={"absolute top-2 right-2"}
                                                        />
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
                                                }, {
                                                    shouldFocus: true,
                                                    focusName: `Data.Instances.${instanceIndex}.DNSRecords.${dnsRecords.fields.length}.Type`
                                                })
                                            }}
                                        >
                                            Додати запис DNS
                                        </Button>
                                    </div>
                                </>
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    name={`Data.Instances.${instanceIndex}.EnvVars`}
                    control={form.control}
                    render={() => (
                        <FormItem className={"w-full"}>
                            <FormControl className={"w-full"}>
                                <>
                                    <FormLabel>Змінні оточення</FormLabel>
                                    <FormMessage/>
                                    <div className={"flex flex-col gap-3"}>
                                        {
                                            envVars.fields.map((envVar, index) => {
                                                return (
                                                    <div
                                                        key={envVar.id}
                                                        className={cn("flex flex-col gap-2 items-center border rounded-lg p-3 relative", form.formState.errors.Data?.Instances?.[instanceIndex]?.EnvVars?.[index] && "border-destructive")}
                                                    >
                                                        <FormField
                                                            control={form.control}
                                                            name={`Data.Instances.${instanceIndex}.EnvVars.${index}.Name`}
                                                            render={({field}) => (
                                                                <FormItem className="w-full">
                                                                    <FormLabel>Назва змінної оточення</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="Назва..." {...field}/>
                                                                    </FormControl>
                                                                    <FormMessage/>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name={`Data.Instances.${instanceIndex}.EnvVars.${index}.Value`}
                                                            render={({field}) => (
                                                                <FormItem className="w-full">
                                                                    <FormLabel>Значення змінної оточення</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="Значення..." {...field}/>
                                                                    </FormControl>
                                                                    <FormMessage/>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <DeleteIcon
                                                            title={"Видалити змінну оточення"}
                                                            onClick={() => {
                                                                envVars.remove(index)
                                                            }}
                                                            className={"absolute top-2 right-2"}
                                                        />
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
                                                }, {
                                                    shouldFocus: true,
                                                    focusName: `Data.Instances.${instanceIndex}.EnvVars.${dnsRecords.fields.length}.Name`
                                                })
                                            }}
                                        >
                                            Додати змінну оточення
                                        </Button>
                                    </div>
                                </>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    )
}