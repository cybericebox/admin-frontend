"use client"
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type React from "react";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import {useRouter} from "next/navigation";
import toast from "react-hot-toast";

export default function QueryProvider({children}: {
    children: React.ReactNode;
}) {
    const router = useRouter()
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                refetchOnMount: false,
                refetchOnReconnect: false,
                staleTime: 5 * 60 * 1000,
                refetchInterval: 5 * 60 * 1000,
            },
            mutations: {
                onError: (error) => {
                    const res = error.cause as Response
                    if (res.status === 401 || res.status === 307) {
                        router.refresh()
                    } else {
                        toast.error(error.message);
                    }
                }
            }
        }
    })
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false}/>
        </QueryClientProvider>
    )
}