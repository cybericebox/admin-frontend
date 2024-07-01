import * as z from "zod";

export interface Exercise {
    ID?: string;
    CategoryID: string;
    Name: string;
    Description: string;
    Data: ExerciseData;
}

export interface ExerciseData {
    Tasks: ExerciseTask[];
    Instances: ExerciseInstance[];
}

export interface ExerciseTask {
    ID?: string;
    Name: string;
    Description: string;
    Points: number;
    Flags: string[];
    LinkedInstanceID?: string;
    InstanceFlagVar?: string;
}


export interface ExerciseInstance {
    ID?: string;
    Name: string;
    Image: string;
    EnvVars: ExerciseInstanceEnvVar[];
    DNSRecords: ExerciseInstanceDNSRecord[];
}

interface ExerciseInstanceEnvVar {
    Name: string;
    Value: string;
}

interface ExerciseInstanceDNSRecord {
    Type: string
    Name: string
    Value: string
}

export const ExerciseTaskSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Description: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Опис має складатися хоча б з 2 символів"}).max(4096, {message: "Опис має складатися не більше ніж з 1024 символів"}),
    Points: z.number({required_error: "Поле має бути заповненим"}).min(1, {message: "Бали мають бути більшими за 0"}),
    UseRandomFlag: z.boolean().optional(),
    Flags: z.array(z.string()).min(0),
    Link: z.any(),
    LinkedInstanceID: z.any(),
    InstanceFlagVar: z.any(),
}).refine(({LinkedInstanceID, InstanceFlagVar}) => !!LinkedInstanceID && !!InstanceFlagVar, {})

export const ExerciseInstanceEnvVarSchema = z.object({
    Name: z.string({required_error: "Поле має бути заповненим"}),
    Value: z.string({required_error: "Поле має бути заповненим"}),
})

export const ExerciseInstanceDNSRecordSchema = z.object({
    Type: z.string({required_error: "Поле має бути заповненим"}),
    Name: z.string({required_error: "Поле має бути заповненим"}),
    Value: z.string({required_error: "Поле має бути заповненим"}),
})

export const ExerciseInstanceSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid(),
    Name: z.string({required_error: "Поле має бути заповненим"}),
    Image: z.string({required_error: "Поле має бути заповненим"}),
    EnvVars: z.array(ExerciseInstanceEnvVarSchema),
    DNSRecords: z.array(ExerciseInstanceDNSRecordSchema)
})

export const ExerciseSchema = z.object({
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    CategoryID: z.string({required_error: "Поле має бути заповненим"}).uuid({message: "Оберіть категорію"}),
    Description: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Опис має складатися хоча б з 2 символів"}).max(4096, {message: "Опис має складатися не більше ніж з 1024 символів"}),
    Tasks: z.array(z.any()),
    Instances: z.array(z.any())

})

export interface ExerciseCategory {
    ID?: string;
    Name: string;
    Description: string;
    CreatedAt?: Date;
}

export const ExerciseCategorySchema = z.object({
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Description: z.string({required_error: "Поле має бути заповненим"}).max(4096, {message: "Опис має складатися не більше ніж з 4096 символів"}),
})