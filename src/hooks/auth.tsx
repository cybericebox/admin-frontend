"use client";
import type React from "react";
import {deleteCookie, getCookie} from "cookies-next"
import {type IAuthenticated} from "@/types/auth";

const permissionsTokenField = "permissionsToken"

function AuthenticatedOnClient(): IAuthenticated {
    try {
        const token = getCookie(permissionsTokenField)
        // if no token, return false
        if (!token) {
            return {
                IsAuthenticated: false,
                ID: ""
            }
        }

        // if token is string, parse it
        if (typeof token === "string") {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            const userID = payload?.sub
            return {
                IsAuthenticated: !!userID,
                ID: userID
            }
        }

        return {
            IsAuthenticated: false,
            ID: ""
        }

    } catch (e) {
        return {
            IsAuthenticated: false,
            ID: ""
        }
    }
}

async function AuthenticatedOnServer(): Promise<IAuthenticated> {
    try {
        const tokenPromise = getCookie(permissionsTokenField)
        // if no tokenPromise, return false
        if (!tokenPromise) {
            return {
                IsAuthenticated: false,
                ID: ""
            }
        }

        // if tokenPromise is not a promise, return false
        if (typeof tokenPromise !== "object" || typeof tokenPromise.then !== "function") {
            return {
                IsAuthenticated: false,
                ID: ""
            }
        }

        const token = await tokenPromise

        // if token is string, parse it
        if (typeof token === "string") {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            const userID = payload?.sub
            return {
                IsAuthenticated: !!userID,
                ID: userID
            }
        }

        return {
            IsAuthenticated: false,
            ID: ""
        }

    } catch (e) {
        return {
            IsAuthenticated: false,
            ID: ""
        }
    }

}

export function WithUserAuthentication({children}: { children: React.ReactNode }) {
    const user = AuthenticatedOnClient()
    if (user.IsAuthenticated) {
        return children
    }
    return null
}

export const SignInLink = "/sign-in"
export const SignUpLink = "/sign-up"
export const ForgotPasswordLink = "/forgot-password"
export const GoogleAPILink = "/api/auth/google"

const fromURLField = "fromURL"

// Get the value of the fromURL cookie and delete it from the client
export function GetFromURL(defaultValue: string): string {
    const value = getCookie(fromURLField)
    deleteCookie(fromURLField, {
        path: "/",
        domain: `.${process.env.NEXT_PUBLIC_DOMAIN || ""}`,
        secure: true,
    })
    if (typeof value === "string") {
        return value || defaultValue
    }
    return defaultValue
}

