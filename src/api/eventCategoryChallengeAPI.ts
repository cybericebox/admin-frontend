import type {ChallengeCategory, Order} from "@/types/challenge";

export const getEventChallengeCategoriesFn = async (eventID: string): Promise<ChallengeCategory[]> => {
    return fetch(`/api/events/${eventID}/challenges/categories`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get event challenge categories", {
                cause: res
            })
        }
    });
}

export const createEventChallengeCategoryFn = async (eventID: string, category: ChallengeCategory) => {
    return fetch(`/api/events/${eventID}/challenges/categories`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(category)
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to create event challenge category", {
                cause: res
            })
        }
    });
}

export const updateEventChallengeCategoryFn = async (category: ChallengeCategory) => {
    return fetch(`/api/events/${category.EventID}/challenges/categories/${category.ID}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(category)
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to update event challenge category", {
                cause: res
            })
        }
    });
}

export const deleteEventChallengeCategoryFn = async (eventID: string, categoryID: string) => {
    return fetch(`/api/events/${eventID}/challenges/categories/${categoryID}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to delete event challenge category", {
                cause: res
            })
        }
    });
}


export interface UpdateEventChallengeCategoriesOrderData {
    Order: Order[];
}

export const updateEventChallengeCategoriesOrderFn = async (eventID: string, data: UpdateEventChallengeCategoriesOrderData) => {
    return fetch(`/api/events/${eventID}/challenges/categories/order`, {
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
            throw new Error("Failed to update event challenge categories order", {
                cause: res
            })
        }
    });
}