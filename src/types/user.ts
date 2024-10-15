import {z} from "zod";

export const UserSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid({message: "Некоректний ідентифікатор"}),
    Email: z.string({required_error: "Поле має бути заповненим"}).email({message: "Введіть коректну адресу електронної пошти"}),
    Name: z.string({required_error: "Поле має бути заповненим"})
        .min(3, {message: "Ім'я має складатися хоча б з 3 символів"}),
    Role: z.union([z.literal("Користувач"), z.literal("Адміністратор")]),
    Picture: z.string({required_error: "Поле має бути заповненим"}).max(0).or(z.string().url({message: "Некоректне посилання на зображення"})).optional(),
    LastSeen: z.coerce.date({required_error: "Поле має бути заповненим"}),
    CreatedAt: z.coerce.date({required_error: "Поле має бути заповненим"}),
})

export interface IUser extends z.infer<typeof UserSchema> {
}

export const InviteUsersSchema = z.object({
    Role: UserSchema.shape.Role,
    Emails: z.array(UserSchema.shape.Email),
})

export interface IInviteUsers extends z.infer<typeof InviteUsersSchema> {
}