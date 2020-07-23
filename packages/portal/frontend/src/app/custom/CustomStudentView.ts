import {OnsButtonElement} from "onsenui";
import Log from "../../../../../common/Log";
import {Payload, TeamFormationTransport, TeamTransport} from "../../../../../common/types/PortalTypes";

import {Leaderboard, LeaderboardInfo} from "../../../../../common/types/CS310Types";
import {UI} from "../util/UI";
import {AbstractStudentView} from "../views/AbstractStudentView";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

/**
 * CS 310 student view does not differ from the stock student view, except that it provides
 * UI for forming teams.
 */
export class ClassyStudentView extends AbstractStudentView {

    private teams: TeamTransport[];
    private leaderboardInfo: LeaderboardInfo;

    constructor(remoteUrl: string) {
        super();
        Log.info("CustomStudentView::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CustomStudentView::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();

        UI.showModal("Fetching data.");
        super.render().then(function() {
            // super render complete; do custom work
            return that.renderStudentPage();
        }).then(function() {
            Log.info('CustomStudentView::renderPage(..) - prep & render took: ' + UI.took(start));
            UI.hideModal();
        }).catch(function(err) {
            Log.error('CustomStudentView::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async renderStudentPage(): Promise<void> {
        UI.showModal('Fetching Data');
        try {
            Log.info('CustomStudentView::renderStudentPage(..) - start');

            // grades renedered in AbstractStudentView

            // repos rendered in AbstractStudentView

            // teams rendered here
            const [teams, leaderboardInfo] = await Promise.all([this.fetchTeamData(), this.fetchLeaderboardData()]);
            this.teams = teams;
            await this.renderTeams(teams);

            this.leaderboardInfo = leaderboardInfo;
            await this.renderLeaderboards(leaderboardInfo);

            Log.info('CustomStudentView::renderStudentPage(..) - done');
        } catch (err) {
            Log.error('Error encountered: ' + err.message);
        }
        UI.hideModal();
        return;
    }

    private async fetchTeamData(): Promise<TeamTransport[]> {
        try {
            this.teams = null;
            let data: TeamTransport[] = await this.fetchData('/portal/teams');
            if (data === null) {
                data = [];
            }
            this.teams = data;
            return data;
        } catch (err) {
            Log.error('CustomStudentView::fetchTeamData(..) - ERROR: ' + err.message);
            this.teams = [];
            return [];
        }
    }

    private async fetchLeaderboardData(): Promise<LeaderboardInfo> {
        try {
            this.leaderboardInfo = null;
            let data: {leaderboards: Leaderboard[], enrolled: boolean} = await this.fetchData('/custom/leaderboards');
            if (data === null) {
                data = {leaderboards: [], enrolled: false};
            }
            this.leaderboardInfo = data;
            return data;
        } catch (err) {
            Log.error('CustomStudentView::fetchLeaderboardData(..) - ERROR: ' + err.message);
            this.leaderboardInfo = {leaderboards: [], enrolled: false};
            return this.leaderboardInfo;
        }
    }

    private async renderTeams(teams: TeamTransport[]): Promise<void> {
        Log.trace('CustomStudentView::renderTeams(..) - start');
        const that = this;

        // make sure these are hidden
        UI.hideSection('studentSelectPartnerDiv');
        UI.hideSection('studentPartnerDiv');

        // skip this all for now; we will redeploy when teams can be formed
        // if (Date.now() > 0) {
        //     return;
        // }

        let projectTeam = null;
        for (const team of teams) {
            if (team.delivId === "project") {
                projectTeam = team;
            }
        }

        if (projectTeam === null) {
            // no team yet

            const button = document.querySelector('#studentSelectPartnerButton') as OnsButtonElement;
            button.onclick = function(evt: any) {
                Log.info('CustomStudentView::renderTeams(..)::createTeam::onClick');
                that.formTeam().then(function(team) {
                    Log.info('CustomStudentView::renderTeams(..)::createTeam::onClick::then - team created');
                    that.teams.push(team);
                    if (team !== null) {
                        that.renderPage({}); // simulating refresh
                    }
                }).catch(function(err) {
                    Log.info('CustomStudentView::renderTeams(..)::createTeam::onClick::catch - ERROR: ' + err);
                });
            };

            UI.showSection('studentSelectPartnerDiv');
        } else {
            // already on team
            UI.showSection('studentPartnerDiv');
            const teamElement = document.getElementById('studentPartnerTeamName');
            const team = projectTeam;
            // TODO: this should be Member CWLs; but TeamTransport will need to be changed for that
            teamElement.innerHTML = team.id + ' - Member CSIDs: ' + JSON.stringify(team.people);
        }
    }

    private async renderLeaderboards(leaderboardInfo: LeaderboardInfo): Promise<void> {
        Log.trace('CustomStudentView::renderLeaderboards(..) - start');
        Log.info(leaderboardInfo);
        if (leaderboardInfo.leaderboards.length === 0) {
            UI.hideSection('leaderboardContainer'); // Ensure this section is hidden
            return;
        } else {
            const projectTeam: TeamTransport = this.teams.find((team) => team.delivId === "project");
            if (leaderboardInfo.enrolled === false && !!projectTeam) {
                // TODO text entry field should have onchange regex validation
                UI.showSection('leaderboardEnrolment');
                const defaultTeamName = projectTeam.id.replace("project_", "");
                (document.getElementById('#enrolLeaderboardText') as HTMLInputElement).value = defaultTeamName;
                const button = document.querySelector('#enrolLeaderboardButton') as OnsButtonElement;
                button.onclick = (evt: Event) => {
                    evt.preventDefault();
                    Log.info('CustomStudentView::renderLeaderboards(..)::enrolLeaderboard::onClick');
                    // TODO
                };
            } else {
                UI.hideSection('leaderboardEnrolment');
            }

            const tableListElement = document.getElementById('leaderboardTableList');
            for (const leaderboard of leaderboardInfo.leaderboards) {
                const id = `leader-${leaderboard.title.replace(/[ \n\t\r]/g, '-')}`;
                tableListElement.innerHTML += `
                <div>
                    <ons-list-item>${leaderboard.title}</ons-list-item>
                    <div id="${id}"></div>
                </div>
                `;

                const headers: TableHeader[] = [
                    {
                        id: `${id}-place`,
                        text: 'Place',
                        sortable: true,
                        defaultSort: true,
                        sortDown: false,
                        style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
                    },
                    {
                        id:          `${id}-team-name`,
                        text:        'Team Name',
                        sortable:    true,
                        defaultSort: false,
                        sortDown:    true,
                        style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
                    },
                    {
                        id:          `${id}-value`,
                        text:        'Value',
                        sortable:    false,
                        defaultSort: false,
                        sortDown:    false,
                        style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
                    }
                ];

                const sortableTable = new SortableTable(headers, `#${id}`);
                let place;
                for (let i = 0; i < leaderboard.rows.length; i = i + 1) {
                    const row = leaderboard.rows[i];

                    if (i === 0 || row.value !== leaderboard.rows[i - 1].value) {
                        place = i + 1;
                    }

                    const tableRow: TableCell[] = [
                        {value: place, html: String(place)},
                        {value: row.name, html: row.name},
                        {value: row.value, html: String(row.value)}
                    ];
                    sortableTable.addRow(tableRow);
                }

                sortableTable.generate();
            }
            UI.showSection('leaderboardContainer');
        }
    }

    private async formTeam(): Promise<TeamTransport> {
        Log.info("CustomStudentView::formTeam() - start");
        const otherId = UI.getTextFieldValue('studentSelectPartnerText');
        const myGithubId = this.getStudent().githubId;
        const payload: TeamFormationTransport = {
            delivId:   'project', // only one team in cs310 (and it is always called project)
            githubIds: [myGithubId, otherId]
        };
        const url = this.remote + '/portal/team';
        const options: any = this.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(payload);

        Log.info("CustomStudentView::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("CustomStudentView::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("CustomStudentView::formTeam() - response: " + JSON.stringify(body));

        if (typeof body.success !== 'undefined') {
            // worked
            return body.success as TeamTransport;
        } else if (typeof body.failure !== 'undefined') {
            // failed
            UI.showError(body);
            return null;
        } else {
            Log.error("CustomStudentView::formTeam() - else ERROR: " + JSON.stringify(body));
        }
    }

}
