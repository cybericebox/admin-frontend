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

export const EventSchemaBase = z.object({
    ID: z.string().uuid().optional(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),
    Tag: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Тег має складатися хоча б з 2 символів"}).max(64, {message: "Тег має складатися не більше ніж з 64 символів"}),
    Picture: z.string().optional().or(z.string().url()),
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
    UpdatedAt: z.coerce.date().optional().nullable(),
    UpdatedBy: z.string().uuid().optional().nullable(),
    ChallengesCount: z.number().int().optional(),
    TeamsCount: z.number().int().optional(),
})

export const EventSchema = EventSchemaBase.refine(({DynamicMaxScore, DynamicMinScore}) => DynamicMinScore <= DynamicMaxScore, {
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

export interface IEvent extends z.infer<typeof EventSchemaBase> {
}

export const EventWithoutMetadataSchema = EventSchemaBase.omit({Description: true, Rules: true, Picture: true}).refine(({DynamicMaxScore, DynamicMinScore}) => DynamicMinScore <= DynamicMaxScore, {
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

export interface IEventWithoutMetadata extends z.infer<typeof EventWithoutMetadataSchema> {
}

export enum ParticipationStatusEnum {
    NoParticipationStatus = 0,
    PendingParticipationStatus = 1,
    ApprovedParticipationStatus = 2,
    RejectedParticipationStatus = 3,
}

export const ParticipationStatusNameEnum = {
    [ParticipationStatusEnum.NoParticipationStatus]: "Не бере участі",
    [ParticipationStatusEnum.PendingParticipationStatus]: "Очікує на затвердження",
    [ParticipationStatusEnum.ApprovedParticipationStatus]: "Затверджено",
    [ParticipationStatusEnum.RejectedParticipationStatus]: "Відхилено",
}

export const TeamSchema = z.object({
    ID: z.string().uuid().optional(),
    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Назва має складатися хоча б з 2 символів"}).max(255, {message: "Назва має складатися не більше ніж з 255 символів"}),

    ParticipantsCount: z.number().int().optional(),

    // score
    Rank: z.number().int().optional(),
    Score: z.number().int().optional(),
    SolvedChallengesCount: z.number().int().optional(),

    ApprovalStatus: z.nativeEnum(ParticipationStatusEnum, {message: "Оберіть статус участі"}),
    Hidden: z.boolean().optional(),

    UpdatedAt: z.coerce.date().optional().nullable(),
    UpdatedBy: z.string().uuid().optional().nullable(),
    CreatedAt: z.coerce.date().optional(),
})

export interface ITeam extends z.infer<typeof TeamSchema> {
}

export const ParticipantSchema = z.object({
    EventID: z.string().uuid(),
    UserID: z.string().uuid(),
    TeamID: z.string().uuid().optional().or(z.null()),
    TeamName: z.string().nullable(),

    Name: z.string({required_error: "Поле має бути заповненим"}).min(2, {message: "Імʼя має складатися хоча б з 2 символів"}).max(255, {message: "Імʼя має складатися не більше ніж з 255 символів"}),
    Email: z.string({required_error: "Поле має бути заповненим"}).email({message: "Введіть коректний email"}),

    ApprovalStatus: z.nativeEnum(ParticipationStatusEnum, {message: "Оберіть статус участі"}),
    Hidden: z.boolean().optional(),

    UpdatedAt: z.coerce.date().optional().nullable(),
    UpdatedBy: z.string().uuid().optional().nullable(),
    CreatedAt: z.coerce.date().optional(),
})

export interface IParticipant extends z.infer<typeof ParticipantSchema> {
}