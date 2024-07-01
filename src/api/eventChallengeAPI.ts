import type {Challenge, Order} from "@/types/challenge";

export const getEventChallengesFn = async (eventID: string): Promise<Challenge[]> => {
    return fetch(`/api/events/${eventID}/challenges`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get event challenges", {
                cause: res
            })
        }
    });
}

export interface UpdateEventChallengeData {
    CategoryID: string;
    ExerciseIDs: string[];
}

export const createEventChallengeFn = async (eventID: string, data: UpdateEventChallengeData) => {
    return fetch(`/api/events/${eventID}/challenges`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to create event challenge", {
                cause: res
            })
        }
    });
}

export const deleteEventChallengeFn = async (eventID: string, challengeID: string) => {
    return fetch(`/api/events/${eventID}/challenges/${challengeID}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to delete event challenge", {
                cause: res
            })
        }
    });
}

export interface UpdateEventChallengesOrderData {
    Order: Order[];
}

export const updateEventChallengesOrderFn = async (eventID: string, data: UpdateEventChallengesOrderData) => {
    return fetch(`/api/events/${eventID}/challenges/order`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data.Order)
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to update event challenges order", {
                cause: res
            })
        }
    });
}

