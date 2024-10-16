import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn} from "react-hook-form";
import * as z from "zod";
import {ExerciseSchema} from "@/types/exercise";
import {DeleteIcon} from "@/components/common/delete";
import {useExercise} from "@/hooks/useExercise";
import axios from "axios";
import {Button} from "@/components/ui/button";
import React, {useRef} from "react";
import {DownloadIcon} from "@/components/common";

interface ExerciseFileFormProps {
    fileIndex: number;
    form: UseFormReturn<z.infer<typeof ExerciseSchema>>
    removeFile: UseFieldArrayRemove
}

interface AddExerciseFileProps {
    addFile: UseFieldArrayAppend<z.infer<typeof ExerciseSchema>>
    nextIndex: number
}

export function AddExerciseFileButton({addFile, nextIndex}: AddExerciseFileProps) {
    const onUploadFile = (fileToUpload: File) => {
        // if there is no file to upload, return
        if (!fileToUpload) return;
        addFile({
            ID: `new-${nextIndex}`,
            Name: fileToUpload.name,
            File: fileToUpload,
            Progress: undefined,
            Ref: null,
            EstimatedTime: 0,
        }, {shouldFocus: true, focusName: `Data.Files.${nextIndex}.Name`})
    }

    return (
        <>
            <input
                type={"file"}
                className={"hidden"}
                id={"file_upload"}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        onUploadFile(file)
                        e.target.value = ""
                    }
                }}
            />
            <Button
                type={"button"}
                className={"w-full"}
                onClick={() => {
                    document.getElementById("file_upload")?.click()
                }}
            >
                Додати файл
            </Button>
        </>

    )
}


export default function ExerciseFileForm({fileIndex, form, removeFile}: ExerciseFileFormProps) {
    const {GetUploadExerciseFileData} = useExercise().useGetUploadExerciseFileData()
    const {GetDownloadExerciseFileData} = useExercise().useGetDownloadExerciseFileData(form.watch("ID") || "", form.watch(`Data.Files.${fileIndex}.ID`), form.watch(`Data.Files.${fileIndex}.Name`))
    const abortRef = useRef<AbortController>(new AbortController())
    if (form.watch(`Data.Files.${fileIndex}.Progress`) != undefined) {
        // if the file is uploading, prevent the user from reloading the page
        window.onbeforeunload = () => true
    }

    if (form.watch(`Data.Files.${fileIndex}.File`)) {
        const fileToUpload: File = form.watch(`Data.Files.${fileIndex}.File`)
        form.setValue(`Data.Files.${fileIndex}.File`, null)
        form.setValue(`Data.Files.${fileIndex}.Ref`, abortRef)
        form.setValue(`Data.Files.${fileIndex}.Progress`, 0)
        form.setValue(`Data.Files.${fileIndex}.EstimatedTime`, 0)

        // get the presigned URL
        GetUploadExerciseFileData().then(({data}) => {
            if (data?.Status.Code == 10000) {
                axios.put(data?.Data.UploadURL, fileToUpload, {
                    headers: {
                        'Content-Type': fileToUpload.type
                    },
                    onUploadProgress: (progressEvent) => {

                        const percentCompleted = Math.round((progressEvent.loaded * 100) / fileToUpload.size)
                        form.setValue(`Data.Files.${fileIndex}.Progress`, percentCompleted)
                        if (progressEvent?.estimated) {
                            form.setValue(`Data.Files.${fileIndex}.EstimatedTime`, new Date(progressEvent?.estimated).getTime())
                        }
                    },
                    signal: form.watch(`Data.Files.${fileIndex}.Ref`).current.signal,
                }).then(() => {
                    form.setValue(`Data.Files.${fileIndex}.ID`, data?.Data.FileID)
                    form.setValue(`Data.Files.${fileIndex}.Ref`, null)
                    form.setValue(`Data.Files.${fileIndex}.Progress`, undefined)
                    form.setValue(`Data.Files.${fileIndex}.EstimatedTime`, undefined)
                }).catch((error) => {
                    if (!axios.isCancel(error)) {
                        if (error.response?.status === 413) {
                            form.setValue(`Data.Files.${fileIndex}.Progress`, -2)
                        } else {
                            form.setValue(`Data.Files.${fileIndex}.Progress`, -3)
                        }
                    }
                })
            }
        })
    }
    return (
        <div
            className={"w-full h-full flex flex-col gap-3 rounded-lg border-2 p-3 relative"}
        >
            <div
                className={"absolute top-2 right-2 flex justify-end gap-2"}
            >
                {form.watch(`Data.Files.${fileIndex}.Progress`) != undefined && (
                    <svg
                        height="18"
                        width="18"
                        viewBox="0 0 20 20  "
                        aria-label={`Завантаження ${form.watch(`Data.Files.${fileIndex}.Progress`)}%`}
                        data-tooltip-html={form.watch(`Data.Files.${fileIndex}.Progress`)! < 0 ? "Помилка завантаження" :
                            `<div style="text-align: center" >Завантажено ${form.watch(`Data.Files.${fileIndex}.Progress`)}% ${form.watch(`Data.Files.${fileIndex}.EstimatedTime`)! > 0 ? "<br/>Залишилось " : ""} ${Math.floor(form.watch(`Data.Files.${fileIndex}.EstimatedTime`)! / 3600) > 0 ? Math.floor(form.watch(`Data.Files.${fileIndex}.EstimatedTime`)! / 3600) + " год. " : ""}${Math.floor(form.watch(`Data.Files.${fileIndex}.EstimatedTime`)! / 60) % 60 > 0 ? Math.floor(form.watch(`Data.Files.${fileIndex}.EstimatedTime`)! / 60) % 60 + " хв. " : ""}${form.watch(`Data.Files.${fileIndex}.EstimatedTime`)! % 60 > 0 ? form.watch(`Data.Files.${fileIndex}.EstimatedTime`)! % 60 + " сек." : ""}</div`}

                        data-tooltip-id="tooltip"
                        className={"mt-0.5"}
                    >
                        <circle
                            r="10"
                            cx="10"
                            cy="10"
                            fill={"#e9ecef"}
                        />
                        <circle
                            r="5"
                            cx="10"
                            cy="10"
                            fill="transparent"
                            stroke={form.watch(`Data.Files.${fileIndex}.Progress`)! > -1 ? "currentColor" : "#ef4444"}
                            strokeWidth="10"
                            strokeDasharray={form.watch(`Data.Files.${fileIndex}.Progress`)! > -1 ? `calc(${form.watch(`Data.Files.${fileIndex}.Progress`)} * 31.4 / 100) 31.4` : "31.4 31.4"}
                            transform="rotate(-90) translate(-20)"
                        />
                        <circle
                            r="7"
                            cx="10"
                            cy="10"
                            fill="white"
                        />
                        {form.watch(`Data.Files.${fileIndex}.Progress`)! < 0 && <path
                            d={"M 6 6 L 14 14 M 6 14 L 14 6"}
                            fill="transparent"
                            stroke={"#ef4444"}
                            strokeWidth="2"
                        />}
                    </svg>
                )}
                {form.watch("ID") && form.watch(`Data.Files.${fileIndex}.Progress`) === undefined && <DownloadIcon
                    title={"Завантажити файл"}
                    onClick={
                        () => {
                            GetDownloadExerciseFileData().then(({data}) => {
                                if (data?.Status.Code == 10000 && typeof window !== 'undefined') {
                                    const downloadURL = data?.Data
                                    if (downloadURL) {
                                        window.open(downloadURL, "_blank")
                                    }
                                }
                            })
                        }
                    }
                />}
                <DeleteIcon
                    title={"Видалити файл"}
                    className={""}
                    onClick={() => {
                        form.watch(`Data.Files.${fileIndex}.Ref`)?.current.abort("File upload was canceled by the user")
                        removeFile(fileIndex)
                    }}
                />
            </div>
            <FormField
                control={form.control}
                name={`Data.Files.${fileIndex}.Name`}
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
    )
}