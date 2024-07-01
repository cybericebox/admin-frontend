import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export async function parseJWT(token: string) {
    if (!token) return null;
    console.log("Token", token)
    console.log("Token", token.split('.')[1])
    console.log("Token", Buffer.from(token.split('.')[1], 'base64').toString())
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}
