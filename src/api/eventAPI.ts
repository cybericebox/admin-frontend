import type {Event} from "@/types/event";

export const getEventsFn = async (): Promise<Event[]> => {
    return fetch('/api/events', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-cache'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get events", {
                cause: res
            })
        }
    })
}

export const getEventByTagFn = async (tag: string): Promise<Event> => {
    return fetch(`/api/events/${tag}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-cache'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get event by tag", {
                cause: res
            })
        }
    })
}

export const createEventFn = async (event: Event) => {
    return fetch('/api/events', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(event)
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to create event", {
                cause: res
            })
        }
    })
}

export const updateEventFn = async (event: Event) => {
    return fetch(`/api/events/${event.ID}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(event)
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to update event", {
                cause: res
            })
        }
    })
}

export const deleteEventFn = async (id: string) => {
    return fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to delete event", {
                cause: res
            })
        }
    });
}