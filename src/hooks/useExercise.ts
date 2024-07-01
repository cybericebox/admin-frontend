import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {createExerciseFn, deleteExerciseFn, getExerciseFn, getExercisesFn, updateExerciseFn} from "@/api/exerciseAPI";
import {Exercise} from "@/types/exercise";
import toast from "react-hot-toast";
import {useRouter} from "next/navigation";

const useGetExercises = () => {
    return useQuery({
        queryKey: ['exercises'],
        queryFn: getExercisesFn,
    })
}

const useGetExercise = (id: string) => {
    return useQuery({
        queryKey: ['exercise', id],
        queryFn: async () => await getExerciseFn(id),
        enabled: !!id,
    })
}

const useCreateExercise = () => {
    const client = useQueryClient()
    const router = useRouter()
    return useMutation({
        mutationKey: ["createExercise"],
        mutationFn: async (data: Exercise) => await createExerciseFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['exercises']}).then(() => {
                toast.success("Завдання успішно створено", {})
                router.push("/exercises")
            }).catch((e) => console.log(e))

        }
    })
}

const useUpdateExercise = () => {
    const client = useQueryClient()
    const router = useRouter()
    return useMutation({
        mutationKey: ["updateExercise"],
        mutationFn: async (data: Exercise) => await updateExerciseFn(data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['exercises']}).then(() => {
                toast.success("Завдання успішно оновлено", {})
                router.push("/exercises")
            }).catch((e) => console.log(e))

        }
    })
}

const useDeleteExercise = () => {
    const client = useQueryClient()
    return useMutation({
        mutationKey: ["deleteExercise"],
        mutationFn: async (id: string) => await deleteExerciseFn(id),
        onSuccess: () => {
            client.invalidateQueries({queryKey: ['exercises']}).then(() => {
                toast.success("Завдання успішно видалено", {})
            }).catch((e) => console.log(e))
        }
    })
}

export const useExercise = () => {
    return {
        useGetExercises,
        useGetExercise,
        useCreateExercise,
        useUpdateExercise,
        useDeleteExercise,
    }
};
