import {z} from "zod";

export const UploadFileDataSchema = z.object({
    FileID: z.string({required_error: "Поле має бути заповненим"}).uuid(),
    UploadURL: z.string({required_error: "Поле має бути заповненим"}).url(),
    DownloadURL: z.string({required_error: "Поле має бути заповненим"}).url(),
})

export interface IUploadFileData extends z.infer<typeof UploadFileDataSchema> {
}

export const DownloadFileURLSchema = z.string({required_error: "Поле має бути заповненим"}).url()

export type IDownloadFileURL = z.infer<typeof DownloadFileURLSchema>

export const TextEditorSchema = z.string().refine((value) => {
    return value.startsWith("<!-- Valid -->")
})

export const ErrorInvalidResponseData = Error("Отримано помилкові дані від серверу. Будь ласка, зверніться до адміністратора.")