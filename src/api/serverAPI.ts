'use server'
import {cookies} from "next/headers";
import {EventSchema, type IEvent} from "@/types/event";
import {ExercisePreprocessedSchema, type IExercise} from "@/types/exercise";
import type {IResponse} from "@/types/api";
import {revalidateTag} from "next/cache";
import {ErrorInvalidResponseData} from "@/types/common";

export const getEventFn = async (id: string): Promise<IResponse<IEvent>> => {
    const response = await fetch(`https://admin.${process.env.NEXT_PUBLIC_DOMAIN}/api/events/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': (await cookies()).toString()
        },
        credentials: 'include',
        cache: 'no-store',
    })
    if (response.ok) {
        // parse the response
        const data = await response.json() as IResponse<IEvent>;
        const res = EventSchema.safeParse(data.Data);
        if (!res.success) {
            console.log(res.error)
            throw ErrorInvalidResponseData
        } else {
            data.Data = res.data;
        }
        return data;
    }
    return Promise.resolve({} as IResponse<IEvent>);
}

export const getExerciseFn = async (id: string): Promise<IResponse<IExercise>> => {
    const response = await fetch(`https://admin.${process.env.NEXT_PUBLIC_DOMAIN}/api/exercises/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': (await cookies()).toString()
        },
        credentials: 'include',
        cache: 'no-store',
    })
    if (response.ok) {
        // parse the response
        const data = await response.json() as IResponse<IExercise>;
        const res = ExercisePreprocessedSchema.safeParse(data.Data);
        if (!res.success) {
            console.log(res.error)
            throw ErrorInvalidResponseData
        } else {
            data.Data = res.data;
        }
        return data;
    }
        return Promise.resolve({} as IResponse<IExercise>);

}

export async function invalidateTag(tag: string) {
    revalidateTag(tag);
}