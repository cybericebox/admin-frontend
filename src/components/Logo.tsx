import type React from "react"
import logo from '@/app/favicon.ico'
import Link from "next/link";
import Image from "next/image";


export interface LogoProps {
    width?: number | `${number}` | undefined;
    height?: number | `${number}` | undefined;
    onClick?: () => void;
}


export default function Logo(props: LogoProps) {
    return (
        <Link href="/" onClick={props.onClick}>
            <Image {...props} src={logo} alt="Cyber ICE Box"/>
        </Link>
    )
}