import fetch from "node-fetch";
import * as restify from "restify";

import Log from "../../../../common/Log";

import {
    LeaderboardEnrolmentTransport,
    LeaderboardInfo,
    LeaderboardPayload
} from "../../../../common/types/CS310Types";
import {Payload} from "../../../../common/types/PortalTypes";
import {AuthController} from "../controllers/AuthController";
import {PersonController} from "../controllers/PersonController";
import {TeamController} from "../controllers/TeamController";
import {Factory} from "../Factory";
import IREST from "../server/IREST";
import {CustomCourseController} from "./CustomCourseController";

/**
 * This class should add any custom routes a course might need.
 */
export default class CustomCourseRoutes implements IREST {
    public registerRoutes(server: restify.Server) {
        Log.trace('CustomCourseRoutes::registerRoutes()');

        server.get('/custom/leaderboards', CustomCourseRoutes.getLeaderboards);
        server.post('custom/leaderboardEnrolment', CustomCourseRoutes.postLeaderboardEnrolment);
    }

    private static getLeaderboards(req: restify.Request, res: restify.Response, next: restify.Next) {
        const user = req.headers.user as string;
        const token = req.headers.token as string;

        CustomCourseRoutes.performGetLeaderboards(user, token).then((success) => {
            const payload: LeaderboardPayload = {success};
            res.send(200, payload);
            return next(false);
        }).catch((error) => {
            Log.info('CustomCourseRoutes::getLeaderboards(..) - ERROR:', error.message);
            const payload: Payload = {failure: {message: error.message, shouldLogout: false}};
            res.send(400, payload);
            return next(true);
        });
    }

    private static postLeaderboardEnrolment(req: restify.Request, res: restify.Response, next: restify.Next) {
        const user = req.headers.user as string;
        const token = req.headers.token as string;

        const enrolmentTransport: LeaderboardEnrolmentTransport = req.params;

        CustomCourseRoutes.performPostEnrolment(user, token, enrolmentTransport).then(() => {
            Log.info('CustomCourseRoutes::performPostEnrolment(..) - done successfully');
            res.send(200);
            return next(false);
        }).catch((error) => {
            Log.info('CustomCourseRoutes::performPostEnrolment(..) - ERROR:', error.message);
            const payload: Payload = {failure: {message: error.message, shouldLogout: false}};
            res.send(400, payload);
            return next(true);
        });
    }

    private static async performGetLeaderboards(user: string, token: string): Promise<LeaderboardInfo> {
        Log.info('CustomCourseRoutes::performGetLeaderboards(..) - start');
        const ac = new AuthController();
        const isValid = await ac.isValid(user, token);
        if (isValid === false) {
            Log.trace('CustomCourseRoutes::performGetLeaderboards(..) - in isValid: ', isValid);
            throw new Error('Invalid credentials');
        } else {
            const tc = new TeamController();
            const pc = new PersonController();

            const person = await pc.getPerson(user);
            // person will always exist (checked in isValid above)

            const team = (await tc.getTeamsForPerson(person)).find((t) => t.delivId === "project");
            const enrolled = team && !!team.custom.leaderboardEnrolment;

            // https://i.imgur.com/PCGct7A.png
            const cc = await Factory.getCourseController() as CustomCourseController;
            return {
                leaderboards: await cc.getLeaderboards(),
                enrolled: enrolled,
            };
        }
    }

    private static async performPostEnrolment(user: string, token: string, enrolment: LeaderboardEnrolmentTransport) {
        Log.info('CustomCourseRoutes::performPostEnrolment(..) - start');
        const ac = new AuthController();
        const isValid = await ac.isValid(user, token);
        if (isValid === false) {
            Log.trace('CustomCourseRoutes::performPostEnrolment(..) - in isValid: ', isValid);
            throw new Error('Invalid credentials');
        } else {
            const tc = new TeamController();
            const pc = new PersonController();

            const person = await pc.getPerson(user);
            // person will always exist (checked in isValid above)

            const team = (await tc.getTeamsForPerson(person)).find((t) => t.delivId === "project");
            if (team === undefined) {
                Log.error('CustomCourseRoutes::performPostEnrolment(..) - Project team not found for', user);
                throw new Error('No project team');
            }

            const defaultName = team.id.replace("project_", "");
            let leaderboardName;
            if (enrolment.name) {
                const searchParams = new URLSearchParams({text: enrolment.name});
                const url = `https://www.purgomalum.com/service/json?${searchParams.toString()}`;
                const response = await fetch(url);
                if (response.status === 200) {
                    leaderboardName = (await response.json()).result;
                } else {
                    throw new Error('Could not get a result from purgomalum');
                }
                if (leaderboardName !== defaultName && /team[0-9][0-9][0-9]/.test(leaderboardName)) {
                    // TODO check if this name is taken by another team?
                    throw new Error("Cannot take another team's name");
                }
            } else {
                leaderboardName = defaultName;
            }

            team.custom.leaderboardEnrolment = enrolment.enrol;
            team.custom.leaderboardName = leaderboardName;
            await tc.saveTeam(team);
        }
    }
}
