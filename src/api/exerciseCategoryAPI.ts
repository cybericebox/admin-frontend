import type {ExerciseCategory} from "@/types/exercise";

export const getExerciseCategoriesFn = async (): Promise<ExerciseCategory[]> => {
    return fetch('/api/exercises/categories', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get exercise categories", {
                cause: res
            })
        }
    });
}

export const getExerciseCategoryFn = async (id: string): Promise<ExerciseCategory> => {
    return fetch(`/api/exercises/categories/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get exercise category by id", {
                cause: res
            })
        }
    });
}

export const createExerciseCategoryFn = async (data: ExerciseCategory) => {
    return fetch('/api/exercises/categories', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to create exercise category", {
                cause: res
            })
        }
    });
}

export const updateExerciseCategoryFn = async (category: ExerciseCategory) => {
    return fetch(`/api/exercises/categories/${category.ID}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(category),
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to update exercise category", {
                cause: res
            })
        }
    });
}

export const deleteExerciseCategoryFn = async (id: string) => {
    return fetch(`/api/exercises/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to delete exercise category", {
                cause: res
            })
        }
    });
}