import {z} from "zod";

export enum UserRoleEnum {
    User = "Користувач",
    Administrator = "Адміністратор"
}

export const UserSchema = z.object({
    ID: z.string({required_error: "Поле має бути заповненим"}).uuid({message: "Некоректний ідентифікатор"}),
    Email: z.string({required_error: "Поле має бути заповненим"}).email({message: "Введіть коректну адресу електронної пошти"}),
    Name: z.string({required_error: "Поле має бути заповненим"})
        .min(3, {message: "Ім'я має складатися хоча б з 3 символів"}),
    Role: z.nativeEnum(UserRoleEnum, {message: "Оберіть роль користувача"}),
    Picture: z.string({required_error: "Поле має бути заповненим"}).max(0).or(z.string().url({message: "Некоректне посилання на зображення"})).optional(),
    LastSeen: z.coerce.date({required_error: "Поле має бути заповненим"}),
    UpdatedAt: z.coerce.date().optional().nullable(),
    UpdatedBy: z.string().uuid().optional().nullable(),
    CreatedAt: z.coerce.date({required_error: "Поле має бути заповненим"}),
})

export interface IUser extends z.infer<typeof UserSchema> {
}

export const InviteUsersSchema = z.object({
    Role: UserSchema.shape.Role,
    Emails: z.array(z.record(UserSchema.shape.Email)).min(1, {message: "Додайте хоча б одну адресу електронної пошти"}),
})

export interface IInviteUsers extends z.infer<typeof InviteUsersSchema> {
}