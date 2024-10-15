import React, {ChangeEvent, useState} from "react";
import Image from "next/image";
import axios from "axios";
import {DeleteIcon} from "@/components/common/delete";
import {useEvent} from "@/hooks/useEvent";
import DownloadIcon from "@/components/common/DownloadIcon";
import Loader from "@/components/common/Loader";

export interface EventBannerFieldProps {
    oldImage?: string
    onChange: (url: string) => void
    eventID?: string
}

export default function EventBannerField({oldImage, onChange, eventID}: EventBannerFieldProps) {
    const [uploadProgress, setUploadProgress] = useState(-1)
    const [loaded, setLoaded] = useState(false)
    const [previewURL, setPreviewURL] = useState<string>(oldImage || "")
    const [showIcon, setShowIcon] = useState(false)
    const {GetUploadEventBannerData} = useEvent().useGetUploadEventBannerData()
    const {GetDownloadEventBannerData} = useEvent().useGetDownloadEventBannerData(eventID || "")

    const onUploadFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadProgress(0)
            setPreviewURL("")
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
                    setPreviewURL(data.Data.DownloadURL)
                    onChange(data.Data.DownloadURL)
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
            {previewURL && showIcon && <div
                className={"absolute top-1 right-1 flex justify-end gap-1 bg-white rounded-xl"}
            >
                <DownloadIcon
                    title={"Завантажити зображення"}
                    onClick={
                        () => {
                            GetDownloadEventBannerData().then(({data}) => {
                                if (data?.Status.Code == 10000) {
                                    setPreviewURL(data.Data)
                                    window.open(data.Data, "_blank")
                                }
                            })
                        }
                    }
                />
                <DeleteIcon
                    title={"Видалити зображення"}
                    onClick={() => {
                        setPreviewURL("")
                        onChange("")
                        setShowIcon(false)
                    }
                    }
                />
            </div>}
            <input
                type="file"
                accept="image/*"
                id="file"
                className="hidden"
                onChange={onUploadFileChange}
            />
            <label
                htmlFor="file"
                className="cursor-pointer flex flex-col items-center justify-center rounded-2xl bg-gray-100">
                {!!previewURL ?
                    <>
                        <Image
                            hidden={!loaded}
                            src={previewURL}
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