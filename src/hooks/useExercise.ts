import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {
    createExerciseFn,
    deleteExerciseFn,
    getDownloadExerciseFileDataFn,
    getExerciseFn,
    getExercisesFn,
    getUploadExerciseFileDataFn,
    updateExerciseFn
} from "@/api/exerciseAPI";
import {ExercisePreprocessedSchema, IExercise} from "@/types/exercise";
import {z} from "zod";
import {DownloadFileURLSchema, ErrorInvalidResponseData, UploadFileDataSchema} from "@/types/common";

interface getExercisesParams {
    search: string,
    categoryID?: string,
}

const useGetExercises = ({search, categoryID}: getExercisesParams) => {
    const {
        data: GetExercisesResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        fetchNextPage: FetchMore,
        hasNextPage: HasMore,
        isFetchingNextPage: isFetchingMore,
    } = useInfiniteQuery({
        queryKey: ['exercises', search, categoryID],
        queryFn: ({pageParam}) => getExercisesFn({search, page: pageParam}),
        select: (data) => {
            data.pages.forEach((page) => {
                const res = z.array(ExercisePreprocessedSchema).safeParse(page.data.Data)
                if (!res.success) {
                    console.log(res.error)
                    throw ErrorInvalidResponseData
                } else {
                    page.data.Data = res.data
                }
                if (!page.data.backUpData) {
                    page.data.backUpData = page.data.Data
                }
                if (categoryID) {
                    page.data.Data = page.data?.backUpData.filter((exercise) => exercise.CategoryID === categoryID)
                } else {
                    page.data.Data = page.data?.backUpData
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
    const GetExercisesRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }

    const GetMoreExercisesRequest = {
        isFetchingMore,
        HasMore,
        FetchMore,
    }

    return {GetExercisesResponse, GetExercisesRequest, GetMoreExercisesRequest}
}

const useGetExercise = (id: string) => {
    const {data: GetExerciseResponse, isLoading, isError, isSuccess, error} = useQuery({
        queryKey: ['exercises', id],
        queryFn: () => getExerciseFn(id),
        enabled: !!id,
        select: (data) => {
            const res = ExercisePreprocessedSchema.safeParse(data.data.Data)
            if (!res.success) {
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })
    const GetExerciseRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }
    return {GetExerciseResponse, GetExerciseRequest}
}

const useGetUploadExerciseFileData = (fileIndex: number) => {
    const {
        data: GetUploadExerciseFileDataResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetUploadExerciseFileData
    } = useQuery({
        queryKey: ['exercises', 'upload', fileIndex],
        queryFn: () => getUploadExerciseFileDataFn(),
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
    const GetUploadExerciseFileDataRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }
    return {GetUploadExerciseFileDataResponse, GetUploadExerciseFileDataRequest, GetUploadExerciseFileData}
}

const useGetDownloadExerciseFileData = (exerciseID: string, fileID: string, fileName: string) => {
    const {
        data: GetDownloadExerciseFileDataResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetDownloadExerciseFileData
    } = useQuery({
        queryKey: ['exercises', exerciseID, 'download', fileID],
        queryFn: () => getDownloadExerciseFileDataFn(exerciseID, fileID, fileName),
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
    const GetDownloadExerciseFileDataRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }
    return {GetDownloadExerciseFileDataResponse, GetDownloadExerciseFileDataRequest, GetDownloadExerciseFileData}
}

const useCreateExercise = () => {
    const queryClient = useQueryClient()
    const {
        mutate: CreateExercise,
        data: CreateExerciseResponse,
        isPending: PendingCreateExercise,
        error: CreateExerciseError
    } = useMutation({
        mutationKey: ["createExercise"],
        mutationFn: async (data: IExercise) => await createExerciseFn(data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['exercises']}).catch((e) => console.log(e))
        }
    })
    return {CreateExercise, CreateExerciseResponse, PendingCreateExercise, CreateExerciseError}
}

const useUpdateExercise = () => {
    const queryClient = useQueryClient()
    const {
        mutate: UpdateExercise,
        data: UpdateExerciseResponse,
        isPending: PendingUpdateExercise,
        error: UpdateExerciseError
    } = useMutation({
        mutationKey: ["updateExercise"],
        mutationFn: async (data: IExercise) => await updateExerciseFn(data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['exercises']}).catch((e) => console.log(e))
        }
    })
    return {UpdateExercise, UpdateExerciseResponse, PendingUpdateExercise, UpdateExerciseError}
}

const useDeleteExercise = () => {
    const queryClient = useQueryClient()
    const {
        mutate: DeleteExercise,
        data: DeleteExerciseResponse,
        isPending: PendingDeleteExercise,
        error: DeleteExerciseError
    } = useMutation({
        mutationKey: ["deleteExercise"],
        mutationFn: async (id: string) => await deleteExerciseFn(id),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['exercises']}).catch((e) => console.log(e))
        }
    })
    return {DeleteExercise, DeleteExerciseResponse, PendingDeleteExercise, DeleteExerciseError}
}

export const useExercise = () => {
    return {
        useGetExercises,
        useGetExercise,
        useGetUploadExerciseFileData,
        useGetDownloadExerciseFileData,
        useCreateExercise,
        useUpdateExercise,
        useDeleteExercise,
    }
};
