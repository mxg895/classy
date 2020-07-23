import {FailurePayload} from "./PortalTypes";

export interface Leaderboard {
    title: string;
    rows: Array<{name: string, value: number}>;
}

export interface LeaderboardInfo {
    leaderboards: Leaderboard[];
    enrolled: boolean;
}

export interface LeaderboardPayload {
    success?: LeaderboardInfo;
    failure?: FailurePayload;
}

export interface LeaderboardEnrolmentTransport {
    name?: string;
    enrol: boolean;
}
