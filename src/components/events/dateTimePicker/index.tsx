"use client"
import {ElementRef, useEffect, useRef, useState} from "react";
import {Instance as Flatpickr} from "flatpickr/dist/types/instance";
import flatpickr from "flatpickr";
import {Input} from "@/components/ui/input";
import "./light.css"
import "flatpickr/dist/l10n/uk.js"

export interface DateTimePickerProps {
    onChange: (selectedDate: Date) => void
    value: Date
    placeholder: string
}

export default function DateTimePicker(props: DateTimePickerProps) {
    const [flatpickrInstance, setFlatpickrInstance] = useState<Flatpickr>()
    const datePickerRef = useRef<ElementRef<"input">>(null)

    useEffect(() => {
        if (datePickerRef.current) {
            const flatpickrInstance = flatpickr(datePickerRef.current, {
                closeOnSelect: true,
                locale: "uk",
                enableTime: true,
                enableSeconds: true,
                dateFormat: "d.m.Y H:i:S",
                minuteIncrement: 1,
                position: "auto center",
                disableMobile: true,
                onChange: (selectedDates) => {
                    if (selectedDates.length > 0) {
                        props.onChange(selectedDates[0])
                    }
                },
                defaultDate: new Date(props.value),

            })

            setFlatpickrInstance(flatpickrInstance)
        }

        return () => flatpickrInstance?.destroy()
    }, [])
    return (
        <Input ref={datePickerRef} placeholder={props.placeholder} type={"text"}/>
    );
}