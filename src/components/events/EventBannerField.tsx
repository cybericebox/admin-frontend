import React, {ChangeEvent, useState} from "react";
import Image from "next/image";
import axios from "axios";
import {DeleteIcon} from "@/components/common/delete";
import {useEvent} from "@/hooks/useEvent";
import DownloadIcon from "@/components/common/DownloadIcon";
import Loader from "@/components/common/Loader";
import UndoIcon from "@/components/common/UndoIcon";
import type {ControllerFieldState, ControllerRenderProps} from "react-hook-form";
import type {IEvent} from "@/types/event";

export interface EventBannerFieldProps {
    field: ControllerRenderProps<IEvent, "Picture">
    fieldState: ControllerFieldState
    oldImage: string | undefined
    eventID: string | undefined
    id?: string
}

export default function EventBannerField({field, fieldState, eventID, oldImage, id}: EventBannerFieldProps) {
    const [uploadProgress, setUploadProgress] = useState(-1)
    const [loaded, setLoaded] = useState(false)
    const [showIcon, setShowIcon] = useState(false)
    const {GetUploadEventBannerData} = useEvent().useGetUploadEventBannerData()
    const {GetDownloadEventBannerData} = useEvent().useGetDownloadEventBannerData(eventID || "")

    const onUploadFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadProgress(0)
            field.onChange("")
            onUploadFile(file)
        }
    }

    const onUploadFile = (fileToUpload: File) => {
        // if there is no file to upload, return
        if (!fileToUpload) return;
        // get the presigned URL
        GetUploadEventBannerData().then(({data}) => {
            if (data?.Status.Code == 10000) {
                axios.put(data?.Data.UploadURL, fileToUpload, {
                    headers: {
                        'Content-Type': fileToUpload.type
                    },
                    onUploadProgress: (progressEvent) => {
                        setUploadProgress(Math.round((progressEvent.loaded / fileToUpload.size) * 100))
                    }
                }).then(() => {
                    setUploadProgress(-1)
                    field.onChange(data.Data.DownloadURL)
                })
            }
        })
    }

    return (
        <div
            className={"flex flex-col text-xl md:text-2xl gap-2 relative max-w-full md:max-w-[42rem] w-auto h-auto max-h-96"}
            onMouseOver={() => setShowIcon(true)}
            onMouseLeave={() => setShowIcon(false)}
        >
            { field.value && showIcon && <div
                className={"absolute top-1 right-1 flex justify-end gap-1 bg-white rounded-xl px-1 py-0.5"}
            >
                {!fieldState.isDirty ? <DownloadIcon
                    title={"Завантажити зображення"}
                    onClick={
                        () => {
                            GetDownloadEventBannerData().then(({data}) => {
                                if (data?.Status.Code == 10000) {
                                    field.onChange(data.Data)
                                    if (typeof window === 'undefined') {
                                        return
                                    }
                                    window.open(data.Data, "_blank")
                                }
                            })
                        }
                    }
                /> : <UndoIcon
                    title={"Скасувати зміни"}
                    onClick={() => {
                        field.onChange(oldImage)
                    }}
                />
                }
                <DeleteIcon
                    title={"Видалити зображення"}
                    onClick={() => {
                        field.onChange("")
                        setShowIcon(false)
                    }
                    }
                />
            </div>}
            <input
                type="file"
                accept="image/*"
                id={id}
                className="hidden"
                onChange={onUploadFileChange}
            />
            <label
                htmlFor={id}
                className="cursor-pointer flex flex-col items-center justify-center rounded-2xl bg-gray-100">
                {!!field.value ?
                    <>
                        <Image
                            hidden={!loaded}
                            src={field.value}
                            alt={"Banner"}
                            width={1920}
                            height={1080}
                            priority={true}
                            className={"rounded-2xl max-w-full max-h-96 w-auto"}
                            onLoad={() => setLoaded(true)}
                        />
                        {!loaded && <div className="flex items-center justify-center h-44 sm:h-56 md:h-96">
                            <Loader/>
                        </div>}
                    </>
                    :
                    uploadProgress === -1 &&
                    <div
                        className="flex items-center justify-center h-44 sm:h-56 md:h-96"
                    >
                        Обрати зображення<br/>(бажано 1920x1080)
                    </div>}
                {uploadProgress > -1 && <div
                    className="flex items-center justify-center h-44 sm:h-56 md:h-96"
                >
                    Завантаження: {uploadProgress}%
                </div>}
            </label>
        </div>
    );
}