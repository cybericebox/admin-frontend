import {cookies} from "next/headers";
import type {Event} from "@/types/event";
import type {Exercise} from "@/types/exercise";
import getEnv from "@/utils/helper";

export const getEventByTagFn = async (tag: string): Promise<Event> => {
    const domain = getEnv("DOMAIN") || ""
    return fetch(`https://admin.${domain}/api/events/${tag}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies().toString()
        },
        credentials: 'include',
        cache: 'no-cache'
    }).then(res => {
        if (res.status === 401) {

        }
        if (res.ok) {
            return res.json();
        }
        return []
    });
}

export const getExerciseByIDFn = async (id: string): Promise<Exercise> => {
    const domain = getEnv("DOMAIN") || ""
    return fetch(`https://admin.${domain}/api/exercises/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies().toString()
        },
        credentials: 'include',
        cache: 'no-cache'
    }).then(res => {
        if (res.ok) {
            return res.json();
        }
        return []
    });
}