'use client'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
    createExerciseCategoryFn,
    deleteExerciseCategoryFn,
    getExerciseCategoriesFn,
    getExerciseCategoryFn,
    updateExerciseCategoryFn
} from "@/api/exerciseCategoryAPI";
import {ExerciseCategory} from "@/types/exercise";
import toast from "react-hot-toast";

const useGetExerciseCategories = () => {
    return useQuery({
        queryKey: ['exerciseCategories'],
        queryFn: getExerciseCategoriesFn,
    });
}

const useGetExerciseCategory = (id: string) => {
    return useQuery({
        queryKey: ['exerciseCategories', id],
        queryFn: async () => await getExerciseCategoryFn(id),
        enabled: !!id,
    });
}

const useCreateExerciseCategory = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["createExerciseCategory"],
        mutationFn: async (data: ExerciseCategory) => await createExerciseCategoryFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['exerciseCategories']}).then(() => {
                toast.success("Категорію успішно створено", {})
            }).catch((e) => console.log(e))
        }
    })
}

const useUpdateExerciseCategory = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["updateExerciseCategory"],
        mutationFn: async (data: ExerciseCategory) => await updateExerciseCategoryFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['exerciseCategories']}).then(() => {
                toast.success("Категорію успішно оновлено", {})
            }).catch((e) => console.log(e))
        }
    })
}

const useDeleteExerciseCategory = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["deleteExerciseCategory"],
        mutationFn: async (id: string) => await deleteExerciseCategoryFn(id),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['exerciseCategories']}).then(() => {
                toast.success("Категорію успішно видалено", {})
            }).catch((e) => console.log(e))
        }
    })
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