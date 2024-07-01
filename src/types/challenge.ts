import {z} from "zod";

export interface Challenge {
    ID?: string
    EventID: string
    CategoryID: string

    ExerciseID: string
    ExerciseTaskID: string

    Name: string
    Description: string
    Points: number

    Order: number

    CreatedAt?: Date
}

export interface ChallengeCategory {
    ID?: string
    EventID: string
    Name: string
    Order: number
    CreatedAt?: Date
}

export interface Order {
    ID: string
    CategoryID?: string
    Index: number

}


export const ChallengeSchema = z.object({})

export const ChallengeCategorySchema = z.object({
    Name: z.string({required_error: "Поле має бути заповненим"})
})