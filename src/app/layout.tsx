import type {Metadata} from "next";
import "@/app/globals.css";
import type React from "react";
import Providers from "@/utils/providers";
import "moment/locale/uk";
import SideBar from "@/components/sidebar";
import {Toaster} from "react-hot-toast";


export const metadata: Metadata = {
    title: "Dashboard | Cyber ICE Box Platform",
    description: "Cyber ICE Box Platform Dashboard",
};


export default function RootLayout({children}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="uk">
        <body>
        <Providers>
            <SideBar/>
            <main>
                {children}
            </main>
            <Toaster/>
        </Providers>
        </body>
        </html>
    );
}
