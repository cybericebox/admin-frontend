import * as z from 'zod'
import {TextEditorSchema} from "@/types/common";

export enum RegistrationTypeEnum {
    Close = 0,
    Approval = 1,
    Open = 2,
}

export enum AvailabilityTypeEnum {
    Private = 0,
    Public = 1,
}

export enum ParticipationTypeEnum {
    Individual = 0,
    Team = 1,
}

export enum ScoreboardVisibilityTypeEnum {
    Hidden = 0,
    Private = 1,
    Public = 2,
}

export enum EventTypeEnum {
    Competition = 0,
    Practice = 1,

}

export enum ParticipantsVisibilityTypeEnum {
    Hidden = 0,
    Private = 1,
    Public = 2,
}

export const EventSchema = z.object({
    ID: z.string().uuid().optional(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Tag: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Тег має складатися хоча б з 2 символів"}).max(64, {message: "Тег має складатися не більше ніж з 64 символів"}),
    Picture: z.string().optional(),
    Description: TextEditorSchema,
    Rules: TextEditorSchema,
    DynamicScoring: z.boolean(),
    DynamicMaxScore: z.number().int().min(1, {message: "Максимальний бал має бути більше 0"}),
    DynamicMinScore: z.number().int().min(1, {message: "Мінімальний бал має бути більше 0"}),
    DynamicSolveThreshold: z.number().int().min(1, {message: "Поріг вирішення має бути більше 0"}),
    PublishTime: z.coerce.date(),
    StartTime: z.coerce.date(),
    FinishTime: z.coerce.date(),
    WithdrawTime: z.coerce.date(),
    Type: z.nativeEnum(EventTypeEnum, {message: "Оберіть тип події"}),
    Availability: z.nativeEnum(AvailabilityTypeEnum, {message: "Оберіть доступність реєстрації"}),
    Participation: z.nativeEnum(ParticipationTypeEnum, {message: "Оберіть тип участі"}),
    Registration: z.nativeEnum(RegistrationTypeEnum, {message: "Оберіть тип реєстрації"}),
    ScoreboardAvailability: z.nativeEnum(ScoreboardVisibilityTypeEnum, {message: "Оберіть доступність таблиці результатів"}),
    ParticipantsVisibility: z.nativeEnum(ParticipantsVisibilityTypeEnum, {message: "Оберіть доступність учасників"}),
    CreatedAt: z.coerce.date().optional(),
    ChallengesCount: z.number().int().optional(),
    TeamsCount: z.number().int().optional(),
}).refine(({DynamicMaxScore, DynamicMinScore}) => DynamicMinScore <= DynamicMaxScore, {
    message: "Максимальний бал має бути більше або рівний мінімальному балу",
    path: ["DynamicMaxScore"],
}).refine(({DynamicMaxScore, DynamicMinScore}) => DynamicMinScore <= DynamicMaxScore, {
    message: "Мінімальний бал має бути менше або рівний максимальному балу",
    path: ["DynamicMinScore"],
}).refine(({PublishTime, StartTime}) => StartTime >= PublishTime, {
    message: "Час початку має бути пізніше або рівний часу публікації",
    path: ["StartTime"],
}).refine(({StartTime, FinishTime}) => FinishTime > StartTime, {
    message: "Час завершення має бути пізніше часу початку",
    path: ["FinishTime"],
}).refine(({FinishTime, WithdrawTime}) => WithdrawTime >= FinishTime, {
    message: "Час архівації має бути пізніше або рівний часу завершення",
    path: ["WithdrawTime"],
})

export interface IEvent extends z.infer<typeof EventSchema> {
}

export const TeamInfoSchema = z.object({
    ID: z.string().uuid(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
})

export interface ITeamInfo extends z.infer<typeof TeamInfoSchema> {
}