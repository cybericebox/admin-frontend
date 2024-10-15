"use client";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {EventSchema, IEvent} from "@/types/event";
import {
    createEventFn,
    deleteEventFn,
    getDownloadEventBannerDataFn,
    getEventFn,
    getEventsFn,
    getUploadEventBannerDataFn,
    updateEventFn
} from "@/api/eventAPI";
import {z} from "zod";
import {DownloadFileURLSchema, UploadFileDataSchema} from "@/types/common";

const useGetEvents = () => {
    const {
        data: GetEventsResponse,
        isLoading,
        isError,
        isSuccess,
        error
    } = useQuery({
        queryKey: ['events'],
        queryFn: () => getEventsFn(),
        select: (data) => {
            const res = z.array(EventSchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })

    const GetEventsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetEventsResponse, GetEventsRequest}
}

const useGetEvent = (id?: string) => {
    const {
        data: GetEventResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetEvent
    } = useQuery({
        queryKey: ['events', id],
        queryFn: () => getEventFn(id!),
        enabled: !!id,
        select: (data) => {
            const res = EventSchema.safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })

    const GetEventRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetEventRequest, GetEventResponse, GetEvent}
}

const useGetUploadEventBannerData = () => {
    const {
        data: GetUploadEventBannerDataResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetUploadEventBannerData
    } = useQuery({
        queryKey: ['events', 'upload', 'banner'],
        queryFn: () => getUploadEventBannerDataFn(),
        select: (data) => {
            const res = UploadFileDataSchema.safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
        enabled: false,
    })

    const GetUploadEventBannerDataRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetUploadEventBannerDataResponse, GetUploadEventBannerDataRequest, GetUploadEventBannerData}
}

const useGetDownloadEventBannerData = (id: string) => {
    const {
        data: GetDownloadEventBannerDataResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetDownloadEventBannerData
    } = useQuery({
        queryKey: ['events', id, "download", 'banner'],
        queryFn: () => getDownloadEventBannerDataFn(id),
        select: (data) => {
            const res = DownloadFileURLSchema.safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
        enabled: false,
    })

    const GetDownloadEventBannerDataRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    return {GetDownloadEventBannerDataResponse, GetDownloadEventBannerDataRequest, GetDownloadEventBannerData}
}

const useCreateEvent = () => {
    const queryClient = useQueryClient()
    const {
        data: CreateEventResponse,
        isPending: PendingCreateEvent,
        mutate: CreateEvent
    } = useMutation({
        mutationKey: ["createEvent"],
        mutationFn: async (event: IEvent) => await createEventFn(event),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['events']}).catch((e) => console.log(e))
        }
    })

    return {CreateEventResponse, CreateEvent, PendingCreateEvent}
}

const useUpdateEvent = () => {
    const queryClient = useQueryClient()
    const {
        data: UpdateEventResponse,
        isPending: PendingUpdateEvent,
        mutate: UpdateEvent
    } = useMutation({
        mutationKey: ["updateEvent"],
        mutationFn: async (event: IEvent) => await updateEventFn(event),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['events']}).catch((e) => console.log(e))
        }
    })

    return {UpdateEventResponse, UpdateEvent, PendingUpdateEvent}
}

const useDeleteEvent = () => {
    const queryClient = useQueryClient()
    const {
        data: DeleteEventResponse,
        isPending: PendingDeleteEvent,
        mutate: DeleteEvent
    } = useMutation({
        mutationKey: ["deleteEvent"],
        mutationFn: async (id: string) => await deleteEventFn(id),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['events']}).catch((e) => console.log(e))
        }
    })

    return {DeleteEventResponse, DeleteEvent, PendingDeleteEvent}
}


export const useEvent = () => {
    return {
        useGetEvents,
        useGetEvent,
        useGetUploadEventBannerData,
        useGetDownloadEventBannerData,
        useCreateEvent,
        useUpdateEvent,
        useDeleteEvent,
    }
}

