import {z} from "zod";
import {ExerciseFileSchema} from "@/types/exercise";


export interface IOrder {
    ID: string
    CategoryID?: string
    Index: number

}

export const ChallengeSchema = z.object({
    ID: z.string().uuid().optional(),
    EventID: z.string({required_error: "Поле має бути заповненим"}),
    CategoryID: z.string({required_error: "Поле має бути заповненим"}),
    ExerciseID: z.string({required_error: "Поле має бути заповненим"}),
    ExerciseTaskID: z.string({required_error: "Поле має бути заповненим"}),
    Data: z.object({
        Name: z.string({required_error: "Поле має бути заповненим"}),
        Description: z.string({required_error: "Поле має бути заповненим"}),
        Points: z.number({required_error: "Поле має бути заповненим"}),
        AttachedFiles: z.array(ExerciseFileSchema),
    }),
    Order: z.number().int(),
    CreatedAt: z.coerce.date().optional(),
})

export interface IEventChallenge extends z.infer<typeof ChallengeSchema> {
}

export const ChallengeCategorySchema = z.object({
    ID: z.string().uuid().optional(),
    EventID: z.string({required_error: "Поле має бути заповненим"}),
    Name: z.string({required_error: "Поле має бути заповненим"}),
    Order: z.number().int(),
    CreatedAt: z.coerce.date().optional(),
})

export interface IEventChallengeCategory extends z.infer<typeof ChallengeCategorySchema> {
}

export interface ICreateEventChallenge {
    CategoryID: string;
    ExerciseIDs: string[];
}

export const ChallengeSolutionAttemptSchema = z.object({
  ID: z.string().uuid(),
    EventID: z.string().uuid(),
    ChallengeID: z.string().uuid(),
    TeamID: z.string().uuid(),
    ParticipantID: z.string().uuid(),
    Answer: z.string(),
    Flag : z.string(),
    IsCorrect: z.boolean(),
    Timestamp: z.coerce.date(),
})

export interface IEventChallengeSolutionAttempt extends z.infer<typeof ChallengeSolutionAttemptSchema> {
}