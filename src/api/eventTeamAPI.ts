import type {TeamInfo} from "@/types/event";

export const getEventTeamsFn = async (eventTag: string): Promise<TeamInfo[]> => {
    return fetch(`/api/events/${eventTag}/teams/info`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get event teams", {
                cause: res
            })
        }
    });
}



