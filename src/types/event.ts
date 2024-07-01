import * as z from 'zod'

export interface Event {
    ID?: string;

    Type: number;
    Availability: number;
    Participation: number;

    Tag: string;
    Name: string;
    Description: string;
    Rules: string;
    Picture: string;

    PublishTime: Date;
    StartTime: Date;
    FinishTime: Date;
    WithdrawTime: Date;

    Registration: number;
    ScoreboardAvailability: number;
    ParticipantsVisibility: number;

    DynamicScoring: boolean,
    DynamicMaxScore: number,
    DynamicMinScore: number,
    DynamicSolveThreshold: number,

    CreatedAt?: Date;

    ChallengesCount?: number;
    TeamsCount?: number;
}

export const EventSchema = z.object({
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Tag: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Тег має складатися хоча б з 2 символів"}).max(64, {message: "Тег має складатися не більше ніж з 64 символів"}),
    Picture: z.string(),
    Description: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Опис має складатися хоча б з 2 символів"}),
    Rules: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Правила мають складатися хоча б з 2 символів"}),
    DynamicScoring: z.boolean(),
    DynamicMaxScore: z.number().int().min(1, {message: "Максимальний бал має бути більше 0"}),
    DynamicMinScore: z.number().int().min(1, {message: "Мінімальний бал має бути більше 0"}),
    DynamicSolveThreshold: z.number().int().min(1, {message: "Поріг вирішення має бути більше 0"}),
    PublishTime: z.date(),
    StartTime: z.date(),
    FinishTime: z.date(),
    WithdrawTime: z.date(),
    Type: z.number().int(),
    Availability: z.number().int(),
    Participation: z.number().int(),
    Registration: z.number().int(),
    ScoreboardAvailability: z.number().int(),
    ParticipantsVisibility: z.number().int(),
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

export enum RegistrationType {
    Open = 0,
    Approval = 1,
    Close = 2,
}

export enum ParticipationType {
    Individual = 0,
    Team = 1,
}

export enum ScoreboardVisibilityType {
    Hidden = 0,
    Public = 1,
    Private = 2,
}

export enum EventType {
    Competition = 0,
    Practice = 1,

}

export enum ParticipantsVisibilityType {
    Hidden = 0,
    Public = 1,
    Private = 2,
}

export interface TeamInfo {
    ID: string;
    Name: string;
}