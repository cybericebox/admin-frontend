import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
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
import {DownloadFileURLSchema, UploadFileDataSchema} from "@/types/common";

interface GetExercisesParams {
    search: string,
    categoryID?: string,
    filter?: (exercise: IExercise) => boolean
}

const useGetExercises = ({search, categoryID, filter}: GetExercisesParams) => {
    const {data: GetExercisesResponse, isLoading, isError, isSuccess, error} = useQuery({
        queryKey: ['exercises', search, categoryID],
        queryFn: () => getExercisesFn(search),
        select: (data) => {
            const res = z.array(ExercisePreprocessedSchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }
            if (!data.data.backUpData) {
                data.data.backUpData = data.data.Data
            }
            if (categoryID) {
                data.data.Data = data.data?.backUpData.filter((exercise) => exercise.CategoryID === categoryID)
            } else {
                data.data.Data = data.data?.backUpData
            }

            if (filter) {
                data.data.Data = data.data.Data.filter(filter)
            }

            return data.data
        }
    })
    const GetExercisesRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }
    return {GetExercisesResponse, GetExercisesRequest}
}

const useGetExercise = (id: string) => {
    const {data: GetExerciseResponse, isLoading, isError, isSuccess, error} = useQuery({
        queryKey: ['exercises', id],
        queryFn: () => getExerciseFn(id),
        enabled: !!id,
        select: (data) => {
            const res = ExercisePreprocessedSchema.safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
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

const useGetUploadExerciseFileData = () => {
    const {
        data: GetUploadExerciseFileDataResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetUploadExerciseFileData
    } = useQuery({
        queryKey: ['exercises', 'upload'],
        queryFn: () => getUploadExerciseFileDataFn(),
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
                throw new Error("Invalid response")
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
