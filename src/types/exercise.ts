import * as z from "zod";
import {TextEditorSchema} from "@/types/common";

export const ExerciseFileSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    File: z.any().optional(),
    Ref: z.any().optional(),
    Progress: z.number().optional(),
    EstimatedTime: z.number().optional(),
})

// @ts-ignore
export const ExerciseTaskSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(50, {message: "Назва має складатися не більше ніж з 50 символів"}),
    Description: TextEditorSchema,
    Points: z.number({required_error: "Поле має бути заповненим"}).int({message: "Бали мають бути цілим числом"}).min(1, {message: "Бали мають бути більше 0"}).max(100, {message: "Бали мають бути менше 100"}),
    UseRandomFlag: z.coerce.boolean(),
    Flags: z.array(z.string().regex(/^ICE{/, {message: "Прапор має починатися з \"ICE{\""}).regex(/^[\w\S]*$/, {message: "Прапор має містити лише букви, цифри та символи"}).min(5, {message: "Прапор має складатися хоча б з 5 символів"}).max(254, {message: "Прапор має складатися не більше ніж з 255 символів"}).regex(/}$/, {message: "Прапор має закінчуватися на \"}\""})
    ),
    Link: z.coerce.boolean(),
    LinkedInstanceID: z.string().uuid().optional(),
    InstanceFlagVar: z.coerce.string().optional(),
    AttachedFileIDs: z.array(z.string().uuid())
}).refine(({InstanceFlagVar, Link}) => {
    if (Link) {
        return !!InstanceFlagVar
    }
    return true
}, {
    message: "Оберіть змінну для прапору",
    path: ["InstanceFlagVar"]
}).refine(({LinkedInstanceID, Link}) => {
    if (Link) {
        return !!LinkedInstanceID
    }
    return true
}, {
    message: "Оберіть віртуальну машину для прапору",
    path: ["LinkedInstanceID"]
}).refine(({UseRandomFlag, Flags}) => {
    if (!UseRandomFlag) {
        return Flags.length > 0
    }
    return true
}, {
    message: "Додайте хоча б один прапор",
    path: ["Flags"]
})

export const ExerciseInstanceEnvVarSchema = z.object({
    Name: z.string({required_error: "Поле має бути заповненим"}).min(1, {message: "Назва має складатися хоча б з 1 символа"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Value: z.string({required_error: "Поле має бути заповненим"}),
})

export const ExerciseInstanceDNSRecordSchema = z.object({
    Type: z.string({required_error: "Поле має бути заповненим"}),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(1, {message: "Назва має складатися хоча б з 1 символа"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Value: z.string({required_error: "Поле має бути заповненим"}).optional(),
}).refine(({Type, Value}) => {
    if (Type === "A" || Type === "AAAA") {
        return true
    }
    return !!Value
}, {
    message: "Заповніть значення",
})

export const ExerciseInstanceSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(50, {message: "Назва має складатися не більше ніж з 50 символів"}),
    Image: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Посилання має складатися хоча б з 2 символів"}).max(255, {message: "Посилання має складатися не більше ніж з 255 символів"}),
    EnvVars: z.array(ExerciseInstanceEnvVarSchema),
    DNSRecords: z.array(ExerciseInstanceDNSRecordSchema)
})

export const ExerciseSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid().optional(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(50, {message: "Назва має складатися не більше ніж з 50 символів"}),
    CategoryID: z.string({required_error: "Поле має бути заповненим"}).uuid({message: "Оберіть категорію"}),
    Description: TextEditorSchema,
    Data: z.object({
        Tasks: z.array(ExerciseTaskSchema).min(1, {message: "Додайте хоча б одну задачу"}),
        Instances: z.array(ExerciseInstanceSchema),
        Files: z.array(ExerciseFileSchema)
    }),

    UpdatedAt: z.coerce.date().optional().nullable(),
    UpdatedBy: z.string().uuid().optional().nullable(),
    CreatedAt: z.coerce.date({required_error: "Поле має бути заповненим"}).optional(),
})

export const ExercisePreprocessedSchema = ExerciseSchema.pick({
    ID: true,
    Name: true,
    CategoryID: true,
    Description: true,
    UpdatedAt: true,
    UpdatedBy: true,
    CreatedAt: true
}).merge(z.object({
    Data: z.object({
        // @ts-ignore
        Tasks: z.array(z.preprocess((data: z.infer<typeof ExerciseTaskSchema>) => {
            data.UseRandomFlag = data.Flags.length === 0;
            data.LinkedInstanceID = data.LinkedInstanceID || undefined;
            data.Link = data.InstanceFlagVar !== undefined && data.InstanceFlagVar !== "";
            return data;
        }, ExerciseTaskSchema)),
        Instances: z.array(ExerciseInstanceSchema),
        Files: z.array(ExerciseFileSchema)
    })
}))

export interface IExercise extends z.infer<typeof ExerciseSchema> {
}

export const ExerciseCategorySchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid().optional(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Description: z.string({required_error: "Поле має бути заповненим"}).max(4096, {message: "Опис має складатися не більше ніж з 4096 символів"}),
    UpdatedAt: z.coerce.date().optional().nullable(),
    UpdatedBy: z.string().uuid().optional().nullable(),
    CreatedAt: z.coerce.date({required_error: "Поле має бути заповненим"}).optional(),
})

export interface IExerciseCategory extends z.infer<typeof ExerciseCategorySchema> {
}