import {RetroScoreMap} from "./ReleaseCheckpoint";
import {ReleasePubPrivCheckpoint} from "./ReleasePubPrivCheckpoint";

export class ReleaseC3 extends ReleasePubPrivCheckpoint {
    protected readonly DELIVID: string = "c3";
    protected readonly DRY_RUN: boolean = true;
    protected readonly TEST_USER: string = "XXXX";
    protected readonly AUDIT_ID: string = 'ReleaseC3';
    protected readonly RETRO_PATH: string = `${__dirname}/c3retros.csv`;

    protected readonly ACCEPTANCE_TEST_COUNT: number = 56;
    protected readonly PUBLIC_TEST_COUNT: number = 61;
    protected readonly PRIVATE_TEST_COUNT: number = Number(process.env.PRIVATE_TEST_COUNT);
    protected readonly CONTRIBUTION_PATH = `${__dirname}/c3contribution.csv`;
    protected readonly TERM: string = "2020W1";

    protected handleRetroRecord(record: { [p: string]: string }, contributionData: Set<string>): RetroScoreMap {
        const columnGroups: Array<[string, string, string]> = [["Q4", "Q5", "Q7"], ["Q9", "Q10", "Q12"], ["Q14", "Q15", "Q17"]];

        const retroMap: RetroScoreMap = {};
        for (const columns of columnGroups) {
            const forceBonus = record["Q3"] === "lonely child :(";
            const {csid, retro} = this.handleRetroForPerson(record, contributionData, columns, forceBonus);
            retroMap[csid] = retro;
        }
        return retroMap;
    }
}
