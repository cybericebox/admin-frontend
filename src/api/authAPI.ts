export const signOut = async () => {
    return await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
    });
}