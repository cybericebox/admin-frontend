"use client";
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
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
import {DownloadFileURLSchema, ErrorInvalidResponseData, UploadFileDataSchema} from "@/types/common";

const useGetEvents = () => {
    const {
        data: GetEventsResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        fetchNextPage: FetchMore,
        hasNextPage: HasMore,
        isFetchingNextPage: isFetchingMore,
    } = useInfiniteQuery({
        queryKey: ['events'],
        queryFn: ({pageParam}) => getEventsFn({page: pageParam}),
        select: (data) => {
            data.pages.forEach((page) => {
                const res = z.array(EventSchema).safeParse(page.data.Data)
                if (!res.success) {
                    throw ErrorInvalidResponseData
                } else {
                    page.data.Data = res.data
                }
            })

            return {
                Status: data.pages[data.pages.length - 1]?.data?.Status,
                Data: data.pages.map((page) => page.data.Data).flat()
            }
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            if (!lastPage?.data?.Data?.length) {
                return undefined
            }

            return lastPageParam + 1
        },
    })

    const GetEventsRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    const GetMoreEventsRequest = {
        isFetchingMore,
        HasMore,
        FetchMore,
    }

    return {GetEventsResponse, GetEventsRequest, GetMoreEventsRequest}
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
                console.log(res.error)
                throw ErrorInvalidResponseData
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
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
        enabled: false,
        staleTime: 0,
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
                console.log(res.error)
                throw ErrorInvalidResponseData
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

