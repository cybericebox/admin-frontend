"use client";
import {getCookie} from "cookies-next"
import {Authenticated} from "@/types/user";

const permissionsTokenField = "permissionsToken"

export function AuthenticatedClient(): Authenticated {
    const token = getCookie(permissionsTokenField) || ""
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const userID = payload?.sub
        return {
            isAuthenticated: !!userID,
            ID: userID
        }
    } catch (e) {
        return {
            isAuthenticated: false,
            ID: ""
        }
    }
}





