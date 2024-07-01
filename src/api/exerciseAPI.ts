import type {Exercise} from "@/types/exercise";

export const getExercisesFn = async (): Promise<Exercise[]> => {
    return fetch('/api/exercises', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get exercisees", {
                cause: res
            })
        }
    });
}

export const getExerciseFn = async (id: string): Promise<Exercise> => {
    return fetch(`/api/exercises/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get exercise by id", {
                cause: res
            })
        }
    });
}

export const createExerciseFn = async (data: Exercise) => {
    return fetch('/api/exercises', {
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
            throw new Error("Failed to create exercise", {
                cause: res
            })
        }
    });
}

export const updateExerciseFn = async (exercise: Exercise) => {
    return fetch(`/api/exercises/${exercise.ID}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(exercise),
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to update exercise", {
                cause: res
            })
        }
    });
}

export const deleteExerciseFn = async (id: string) => {
    return fetch(`/api/exercises/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to delete exercise", {
                cause: res
            })
        }
    });
}
