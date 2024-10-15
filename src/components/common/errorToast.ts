import {IErrorResponse} from "@/types/api";
import toast from "react-hot-toast";

interface ErrorToastProps {
    message: string;
    error: IErrorResponse;
}

export const ErrorToast = ({message, error}: ErrorToastProps) => {
    const errorCauseDescription = error?.response?.data.Status.Message || ""
    const errorCauseCode = error?.response?.data.Status.Code || ""
    const errorCause = errorCauseCode ? ` (${errorCauseCode})` : ""
    toast.error(`${message}\n${errorCauseDescription}${errorCause}`)
}