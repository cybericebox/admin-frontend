'use client'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
    createExerciseCategoryFn,
    deleteExerciseCategoryFn,
    getExerciseCategoriesFn,
    getExerciseCategoryFn,
    updateExerciseCategoryFn
} from "@/api/exerciseCategoryAPI";
import {ExerciseCategorySchema, IExerciseCategory} from "@/types/exercise";
import {z} from "zod";

const useGetExerciseCategories = () => {
    const {data: GetExerciseCategoriesResponse, isLoading, isError, isSuccess, error} = useQuery({
        queryKey: ['exerciseCategories'],
        queryFn: () => getExerciseCategoriesFn(),
        select: (data) => {
            const res = z.array(ExerciseCategorySchema).safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })
    const GetExerciseCategoriesRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }
    return {GetExerciseCategoriesResponse, GetExerciseCategoriesRequest}
}

const useGetExerciseCategory = (id: string) => {
    const {data: GetExerciseCategoryResponse, isLoading, isError, isSuccess, error} = useQuery({
        queryKey: ['exerciseCategory', id],
        queryFn: () => getExerciseCategoryFn(id),
        enabled: !!id,
        select: (data) => {
            const res = ExerciseCategorySchema.safeParse(data.data.Data)
            if (!res.success) {
                throw new Error("Invalid response")
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })
    const GetExerciseCategoryRequest = {
        isLoading,
        isError,
        isSuccess,
        error,
    }
    return {GetExerciseCategoryResponse, GetExerciseCategoryRequest}
}

const useCreateExerciseCategory = () => {
    const queryClient = useQueryClient()
    const {
        data: CreateExerciseCategoryResponse,
        isPending: PendingCreateExerciseCategory,
        mutate: CreateExerciseCategory
    } = useMutation({
        mutationKey: ["createExerciseCategory"],
        mutationFn: async (data: IExerciseCategory) => await createExerciseCategoryFn(data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['exerciseCategories']}).catch((e) => console.log(e))
        }
    })
    return {CreateExerciseCategory, PendingCreateExerciseCategory, CreateExerciseCategoryResponse}
}

const useUpdateExerciseCategory = () => {
    const queryClient = useQueryClient()
    const {
        data: UpdateExerciseCategoryResponse,
        isPending: PendingUpdateExerciseCategory,
        mutate: UpdateExerciseCategory
    } = useMutation({
        mutationKey: ["updateExerciseCategory"],
        mutationFn: async (data: IExerciseCategory) => await updateExerciseCategoryFn(data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['exerciseCategories']}).catch((e) => console.log(e))
        }
    })
    return {UpdateExerciseCategory, PendingUpdateExerciseCategory, UpdateExerciseCategoryResponse}
}

const useDeleteExerciseCategory = () => {
    const queryClient = useQueryClient()
    const {
        data: DeleteExerciseCategoryResponse,
        isPending: PendingDeleteExerciseCategory,
        mutate: DeleteExerciseCategory
    } = useMutation({
        mutationKey: ["deleteExerciseCategory"],
        mutationFn: async (id: string) => await deleteExerciseCategoryFn(id),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['exerciseCategories']}).catch((e) => console.log(e))
        }
    })
    return {DeleteExerciseCategory, PendingDeleteExerciseCategory, DeleteExerciseCategoryResponse}
}

export const useExerciseCategory = () => {
    return {
        useGetExerciseCategories,
        useGetExerciseCategory,
        useCreateExerciseCategory,
        useUpdateExerciseCategory,
        useDeleteExerciseCategory,
    }
}