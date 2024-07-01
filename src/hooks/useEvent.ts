"use client";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import type {Event} from "@/types/event";
import {createEventFn, deleteEventFn, getEventByTagFn, getEventsFn, updateEventFn} from "@/api/eventAPI";
import toast from "react-hot-toast";
import {useRouter} from "next/navigation";

const useGetEvents = () => {
    return useQuery({
        queryKey: ['events'],
        queryFn: () => getEventsFn(),
    })
}

const useGetEventByTag = (tag: string) => {
    return useQuery({
        queryKey: ['events', tag],
        queryFn: () => getEventByTagFn(tag),
        enabled: !!tag,
    })
}

const useCreateEvent = () => {
    const client = useQueryClient()
    const router = useRouter()
    return useMutation({
        mutationKey: ["createEvent"],
        mutationFn: async (event: Event) => await createEventFn(event),
        onSuccess: (data) => {
            if (data.ok) {
                client.invalidateQueries({queryKey: ['events']}).then(() => {
                    toast.success("Захід успішно створено")
                }).catch((e) => console.log(e))
            }
        }
    })
}

const useUpdateEvent = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["updateEvent"],
        mutationFn: async (event: Event) => await updateEventFn(event),
        onSuccess: (data) => {
            if (data.ok) {
                client.invalidateQueries({queryKey: ['events']}).then(() => {
                    toast.success("Захід успішно оновлено")
                }).catch((e) => console.log(e))
            }
        }
    })
}

const useDeleteEvent = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["deleteEvent"],
        mutationFn: async (id: string) => await deleteEventFn(id),
        onSuccess: (data) => {
            if (data.ok) {
                client.invalidateQueries({queryKey: ['events']}).then(() => {
                    toast.success("Захід успішно видалено", {})
                }).catch((e) => console.log(e))
            }
        }
    })

}


export const useEvent = () => {
    return {
        useGetEvents,
        useGetEventByTag,
        useCreateEvent,
        useUpdateEvent,
        useDeleteEvent,
    }
}

