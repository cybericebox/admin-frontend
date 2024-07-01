export interface User {
    ID: string;
    Name: string;
    Email: string;
    Role: string;
    LastSeen: Date;
}

export interface Authenticated {
    isAuthenticated: boolean;
    ID: string;
}