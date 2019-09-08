import {Collection, Db, MongoClient} from "mongodb";
import Config, {ConfigCourses, ConfigKey} from "../../../../common/Config";

import Log from "../../../../common/Log";
import Util from "../../../../common/Util";

import {AuditEvent, AuditLabel, Auth, Course, Deliverable, Grade, Person, Repository, Result, Team} from "../Types";

export class DatabaseController {
    /**
     * Returns the current controller; shares Mongo connections.
     *
     * @returns {DatabaseController}
     */
    public static getInstance() {
        if (DatabaseController.instance === null) {
            DatabaseController.instance = new DatabaseController();

            // verify that any mandatory objects that are in the db
            // not great to do this on
        }
        return DatabaseController.instance;
    }

    private static instance: DatabaseController = null;
    private db: Db = null;

    private readonly COURSECOLL = 'course';
    private readonly PERSONCOLL = 'people';
    private readonly GRADECOLL = 'grades';
    private readonly RESULTCOLL = 'results';
    private readonly TEAMCOLL = 'teams';
    private readonly DELIVCOLL = 'deliverables';
    private readonly REPOCOLL = 'repositories';
    private readonly AUTHCOLL = 'auth';
    private readonly AUDITCOLL = 'audit';
    private readonly TICKERCOLL = 'ids';

    /**
     * use getInstance() instead.
     */
    private constructor() {
        Log.info("DatabaseController::<init> - creating new controller");
    }

    public async getPerson(recordId: string): Promise<Person | null> {
        const person = await this.readSingleRecord(this.PERSONCOLL, {id: recordId}) as Person;
        Log.trace("DatabaseController::getPerson( " + recordId + " ) - found: " + (person !== null));
        return person;
    }

    public async getGitHubPerson(recordId: string): Promise<Person | null> {
        const person = await this.readSingleRecord(this.PERSONCOLL, {githubId: recordId}) as Person;
        Log.trace("DatabaseController::getGitHubPerson( " + recordId + " ) - found: " + (person !== null));
        return person;
    }

    public async getRepository(recordId: string): Promise<Repository | null> {
        const repo = await this.readSingleRecord(this.REPOCOLL, {id: recordId}) as Repository;
        Log.trace("DatabaseController::getRepository( " + recordId + " ) - found: " + (repo !== null));
        return repo;
    }

    public async getTeam(recordId: string): Promise<Team | null> {
        const team = await this.readSingleRecord(this.TEAMCOLL, {id: recordId}) as Team;
        Log.trace("DatabaseController::getTeam( " + recordId + " ) - found: " + (team !== null));
        return team;
    }

    public async getAuth(personId: string): Promise<Auth | null> {
        const auth = await this.readSingleRecord(this.AUTHCOLL, {personId: personId}) as Auth;
        Log.trace("DatabaseController::getAuthToken( " + personId + " ) - found: " + (auth !== null));
        return auth;
    }

    public async getRepositories(): Promise<Repository[]> {
        const repos = await this.readRecords(this.REPOCOLL, {}) as Repository[];
        Log.trace("DatabaseController::getRepositories() - #: " + repos.length);
        return repos;
    }

    public async getCourseRecord(): Promise<Course | null> {
        const record = await this.readSingleRecord(this.COURSECOLL, {id: Config.getInstance().getProp(ConfigKey.name)}) as Course;
        Log.trace("DatabaseController::getCourseRecord() - found: " + (record !== null));
        return record;
    }

    public async getTeams(): Promise<Team[]> {
        const teams = await this.readRecords(this.TEAMCOLL, {}) as Team[];
        Log.trace("DatabaseController::getTeams() - #: " + teams.length);
        return teams;
    }

    public async getResults(): Promise<Result[]> {
        const query = {};
        // const latestFirst = {"input.pushInfo.timestamp": -1}; // most recent first
        const latestFirst = {"input.target.timestamp": -1}; // most recent first
        const results = await this.readRecords(this.RESULTCOLL, query, latestFirst) as Result[];
        Log.trace("DatabaseController::getResult() - #: " + results.length);
        for (const result of results) {
            if (typeof (result.input as any).pushInfo !== 'undefined' && typeof result.input.target === 'undefined') {
                // this is a backwards compatibility step that can disappear in 2019 (except for sdmm which will need further changes)
                result.input.target = (result.input as any).pushInfo;
            }
        }
        return results;
    }

    public async getTeamsForPerson(personId: string): Promise<Team[]> {
        Log.info("DatabaseController::getTeamsForPerson() - start");
        const teams = await this.readRecords(this.TEAMCOLL, {});
        const myTeams = [];
        for (const t of teams as Team[]) {
            if (t.personIds.indexOf(personId) >= 0) {
                myTeams.push(t);
            }
        }
        return myTeams;
    }

    public async getRepositoriesForPerson(personId: string): Promise<Repository[]> {
        Log.info("DatabaseController::getRepositoriesForPerson() - start");

        // tslint:disable
        const query = [{
            "$lookup": {
                "from":         "teams",
                "localField":   "teamIds",
                "foreignField": "id",
                "as":           "teams"
            }
        },
            {
                "$lookup": {
                    "from":         "people",
                    "localField":   "teams.personIds",
                    "foreignField": "id",
                    "as":           "teammembers"
                }
            },
            {
                "$match": {"teammembers.id": personId}
            }
        ];
        // tslint:enable

        const collection = await this.getCollection(this.REPOCOLL);
        const records: any[] = await collection.aggregate(query).toArray();

        return records;
    }

    // case issues will be harder to fix than this
    // private fixPersonCase(person: Person): Person {
    //     if (person !== null) {
    //         (person as any).id = person.id.toLowerCase(); // always force id to be lowercase
    //         person.githubId = person.githubId.toLowerCase(); // always force id to be lowercase
    //     }
    //     return person;
    // }

    public async getPeople(): Promise<Person[]> {
        const people = await this.readRecords(this.PERSONCOLL, {}) as Person[];
        Log.trace("DatabaseController::getPeople() - #: " + people.length);
        return people;
    }

    public async getDeliverables(): Promise<Deliverable[]> {
        const delivs = await this.readRecords(this.DELIVCOLL, {}) as Deliverable[];
        Log.trace("DatabaseController::getDeliverables() - #: " + delivs.length);
        return delivs;
    }

    public async getDeliverable(id: string): Promise<Deliverable> {
        const deliv = await this.readSingleRecord(this.DELIVCOLL, {id}) as Deliverable;
        Log.trace("DatabaseController::getDeliverable() - found: " + (deliv !== null));
        return deliv;
    }

    public async getGrades(): Promise<Grade[]> {
        const grades = await this.readRecords(this.GRADECOLL, {}) as Grade[];
        Log.trace("DatabaseController::getGrades() - #: " + grades.length);
        return grades;
    }

    public async getGrade(personId: string, delivId: string): Promise<Grade | null> {
        const grade = await this.readSingleRecord(this.GRADECOLL, {personId: personId, delivId: delivId}) as Grade;
        if (grade !== null) {
            Log.trace("DatabaseController::getGrade( " + personId + ", " + delivId + " ) - grade: " + grade.score);
        } else {
            Log.trace("DatabaseController::getGrade( " + personId + ", " + delivId + " ) - not found");
        }
        return grade;
    }

    public async getUniqueTeamNumber(): Promise<number> {
        const ticker = await this.readAndUpdateSingleRecord(this.TICKERCOLL, {tickerId: "teamNumbers"}, { $inc: { ticker: 1 } });
        Log.trace("DatabaseController::getUniqueTeamNumber() - Found:" + JSON.stringify(ticker));
        if (ticker !== null && ticker.ticker !== undefined) {
            Log.trace("DatabaseController::getUniqueTeamNumber() - " + ticker.ticker);
            return ticker.ticker;
        } else {
            throw new Error("Could not retrieve a team number from the database");
        }
    }

    private async createTeamTicker(): Promise<void> {
        const ticker = await this.readSingleRecord(this.TICKERCOLL, {tickerId: "teamNumbers"});
        if (ticker === null) {
            await this.writeRecord(this.TICKERCOLL, {tickerId: "teamNumbers", ticker: 0});
        }
    }

    public async writePerson(record: Person): Promise<boolean> {
        // Log.info("DatabaseController::writePerson(..) - start");
        const existingPerson = await this.getPerson(record.id);
        if (existingPerson === null) {
            return await this.writeRecord(this.PERSONCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.PERSONCOLL, query, record);
        }
    }

    public async writeTeam(record: Team): Promise<boolean> {
        // Log.info("DatabaseController::writeTeam(..) - start");
        const existingTeam = await this.getTeam(record.id);
        if (existingTeam === null) {
            return await this.writeRecord(this.TEAMCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.TEAMCOLL, query, record);
        }
    }

    public async writeCourseRecord(record: Course): Promise<boolean> {
        // Log.info("DatabaseController::writeCourseRecord(..) - start");
        const existingRecord = await this.getCourseRecord();
        if (existingRecord === null) {
            return await this.writeRecord(this.COURSECOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.COURSECOLL, query, record);
        }
    }

    /**
     * Result records are associated with repos, SHAs, and delivIds. Really the repo could be removed
     * as the SHA (or commitURL) would be enough to work with the delivId.
     *
     * @param {Result} record
     * @returns {Promise<boolean>}
     */
    public async writeResult(record: Result): Promise<boolean> {
        Log.info("DatabaseController::writeResult(..) - start");

        const resultExists = await this.getResult(record.delivId, record.repoId, record.commitSHA);
        if (resultExists === null) {
            Log.trace("DatabaseController::writeResult(..) - new");
            return await this.writeRecord(this.RESULTCOLL, record);
        } else {
            Log.trace("DatabaseController::writeResult(..) - update");
            const query = {commitSHA: record.commitSHA, repoId: record.repoId, delivId: record.delivId};
            return await this.updateRecord(this.RESULTCOLL, query, record);
        }
    }

    /*
    public async deletePerson(record: Person): Promise<boolean> {
        Log.info("DatabaseController::deletePerson(..) - start");
        return await this.deleteRecord(this.PERSONCOLL, {id: record.id});
    }
    */

    public async deleteAuth(record: Auth): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteAuth( " + record.personId + " ) - start");
            return await this.deleteRecord(this.AUTHCOLL, {personId: record.personId});
        }
        return false;
    }

    public async deleteRepository(record: Repository): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteRepository( " + record.id + " ) - start");
            return await this.deleteRecord(this.REPOCOLL, {id: record.id});
        }
        return false;
    }

    public async deleteDeliverable(record: Deliverable): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteDeliverable( " + record.id + " ) - start");
            return await this.deleteRecord(this.DELIVCOLL, {id: record.id});
        }
        return false;
    }

    public async deletePerson(record: Person): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deletePerson( " + record.id + " ) - start");
            return await this.deleteRecord(this.PERSONCOLL, {id: record.id});
        }
        return false;
    }

    public async deleteTeam(record: Team): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteTeam( " + record.id + " ) - start");
            return await this.deleteRecord(this.TEAMCOLL, {id: record.id});
        }
        return false;
    }

    private async deleteRecord(colName: string, query: {}): Promise<boolean> {
        Log.trace("DatabaseController::deleteRecord( " + colName + ", " + JSON.stringify(query) + " ) - start");
        try {
            const collection = await this.getCollection(colName);
            const res = await collection.deleteOne(query);
            Log.trace("DatabaseController::deleteRecord(..) - delete complete; result: " + JSON.stringify(res));
            return true;
        } catch (err) {
            Log.error("DatabaseController::deleteRecord(..) - ERROR: " + err);
            return false;
        }
    }

    public async writeDeliverable(record: Deliverable): Promise<boolean> {
        // Log.info("DatabaseController::writeDeliverable(..) - start");
        // Log.trace("DatabaseController::writeDeliverable(..) - deliv: " + JSON.stringify(record));
        const existingDeiverable = await this.getDeliverable(record.id);
        if (existingDeiverable === null) {
            return await this.writeRecord(this.DELIVCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.DELIVCOLL, query, record);
        }
    }

    public async writeGrade(record: Grade): Promise<boolean> {
        // Log.info("DatabaseController::writeGrade(..) - start");
        // Log.trace("DatabaseController::writeGrade(..) - grade: " + JSON.stringify(record));
        const gradeExists = await this.getGrade(record.personId, record.delivId);
        if (gradeExists === null) {
            return await this.writeRecord(this.GRADECOLL, record);
        } else {
            const query = {personId: record.personId, delivId: record.delivId};
            return await this.updateRecord(this.GRADECOLL, query, record);
        }
    }

    public async writeAudit(label: AuditLabel, personId: string, before: any, after: any, custom: any): Promise<boolean> {
        try {
            // Log.info("DatabaseController::writeAudit(..) - start");
            Log.info("DatabaseController::writeAudit( " + label + ", " + personId + ", hasBefore: " +
                !Util.isEmpty(before) + ", hasAfter: " + !Util.isEmpty(after) + " ) - start");

            let finalLabel = label + '_';
            if (Util.isEmpty(before) === true && Util.isEmpty(after) === true) {
                // is an action, no postfix
                finalLabel = label;
            } else if (Util.isEmpty(before) === true) {
                finalLabel = finalLabel + 'CREATE';
            } else if (Util.isEmpty(after) === true) {
                finalLabel = finalLabel + 'DELETE';
            } else {
                finalLabel = finalLabel + 'UPDATE';
            }
            const auditRecord: AuditEvent = {
                label:     finalLabel,
                timestamp: Date.now(),
                personId:  personId,
                before:    before,
                after:     after,
                custom:    custom
            };
            return await this.writeRecord(this.AUDITCOLL, auditRecord);
        } catch (err) {
            // never want this to mess with whatever called it; eat all errors
            Log.error("DatabaseController::writeAudit(..) - ERROR: " + err.message);
            return false;
        }
    }

    public async writeRepository(record: Repository): Promise<boolean> {
        // Log.info("DatabaseController::writeRepository(..) - start");
        if (record.custom === null) {
            record.custom = {}; // make sure this always exists
        }
        // Log.trace("DatabaseController::writeRepository(..) - repo: " + JSON.stringify(record));
        const existingRepo = await this.getRepository(record.id);
        if (existingRepo === null) {
            return await this.writeRecord(this.REPOCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.REPOCOLL, query, record);
        }
    }

    public async writeRecord(colName: string, record: {}): Promise<boolean> {
        Log.trace("DatabaseController::writeRecord( " + colName + ", ...) - writing");
        // Log.trace("DatabaseController::writeRecord(..) - col: " + colName + "; record: " + JSON.stringify(record));
        try {
            const collection = await this.getCollection(colName);
            const copy = Object.assign({}, record);
            await collection.insertOne(copy);
            // Log.trace("DatabaseController::writeRecord(..) - write complete");
            return true;
        } catch (err) {
            Log.error("DatabaseController::writeRecord(..) - ERROR: " + err);
            return false;
        }
    }

    public async updateRecord(colName: string, query: {}, record: {}): Promise<boolean> {
        Log.trace("DatabaseController::updateRecord( " + colName + ", ...) - start");
        Log.trace("DatabaseController::updateRecord(..) - colName: " + colName + "; record: " + JSON.stringify(record));
        try {
            const collection = await this.getCollection(colName);
            const copy = Object.assign({}, record);
            const res = await collection.replaceOne(query, copy); // copy was record
            Log.trace("DatabaseController::updateRecord(..) - write complete; res: " + JSON.stringify(res));
            return true;
        } catch (err) {
            Log.error("DatabaseController::updateRecord(..) - ERROR: " + err);
            return false;
        }
    }

    /**
     * Returns a ready-to-use `collection` object from MongoDB.
     *
     * Usage:
     *
     *   (await getCollection('users')).find().toArray().then( ... )
     */
    public async getCollection(collectionName: string): Promise<Collection> {
        try {
            const db = await this.open();
            return db.collection(collectionName);
        } catch (err) {
            Log.error("DatabaseController::getCollection( " + collectionName +
                " ) - Mongo is probably not running; ERROR: " + err.message);
            process.exit(-1); // this is a fatal failure
        }
    }

    public async clearData(): Promise<void> {
        Log.warn("DatabaseController::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");

        const configName = Config.getInstance().getProp(ConfigKey.name);
        Log.warn("DatabaseController::clearData() - name: " + configName);

        if (configName === ConfigCourses.classytest) {
            // NOTE: can only delete data if the current instance is the main test instance
            // This prevents us from running the tests in production by accident and wiping the database

            const cols = [this.PERSONCOLL, this.GRADECOLL, this.RESULTCOLL, this.TEAMCOLL,
                this.DELIVCOLL, this.REPOCOLL, this.AUTHCOLL, this.COURSECOLL, this.AUDITCOLL];

            for (const col of cols) {
                Log.info("DatabaseController::clearData() - removing data for collection: " + col);
                const collection = await this.getCollection(col);
                await collection.deleteMany({});
            }
            Log.info("DatabaseController::clearData() - data removed");

            await this.initDatabase();
            Log.info("DatabaseController::clearData() - database reset with initial objects");
        } else {
            throw new Error("DatabaseController::clearData() - can only be called on test configurations");
        }
        return;
    }

    /**
     *
     * @param {string} column
     * @param {{}} query
     * @returns {Promise<{} | null>}
     */
    private async readSingleRecord(column: string, query: {}): Promise<{} | null> {
        try {
            // Log.trace("DatabaseController::readSingleRecord( " + column + ", " + JSON.stringify(query) + " ) - start");
            const start = Date.now();
            const col = await this.getCollection(column);

            const records: any[] = await (col as any).find(query).toArray();
            if (records === null || records.length === 0) {
                // Log.trace("DatabaseController::readSingleRecord(..) - done; no records found; took: " + Util.took(start));
                return null;
            } else {
                // Log.trace("DatabaseController::readSingleRecord(..) - done; # records: " +
                // records.length + "; took: " + Util.took(start));
                const record = records[0];
                delete record._id; // remove the record id, just so we can't use it
                return record;
            }
        } catch (err) {
            Log.error("DatabaseController::readSingleRecord(..) - ERROR: " + err);
            return null;
        }
    }

    /**
     *
     * @param {string} column
     * @param {{}} query send {} if all results for that column are wanted
     * * @param {{}} sort? send only if a specific ordering is required
     * @returns {Promise<any[]>} An array of objects
     */
    public async readRecords(column: string, query: {}, sort?: {}): Promise<any[]> {
        try {
            // Log.trace("DatabaseController::readRecords( " + column + ", " + JSON.stringify(query) + " ) - start");
            const start = Date.now();
            const col = await this.getCollection(column);

            let records: any[];
            if (typeof sort === 'undefined') {
                records = await (col as any).find(query).toArray();
            } else {
                records = await (col as any).find(query).sort(sort).toArray();
            }

            if (records === null || records.length === 0) {
                // Log.trace("DatabaseController::readRecords(..) - done; no records found for: " +
                //     JSON.stringify(query) + " in: " + column + "; took: " + Util.took(start));
                return [];
            } else {
                // Log.trace("DatabaseController::readRecords(..) - done; # records: " +
                //     records.length + ". took: " + Util.took(start));
                for (const r of records) {
                    delete r._id; // remove the record id, just so we can't use it
                }
                return records;
            }
        } catch (err) {
            Log.error("DatabaseController::readRecords(..) - ERROR: " + err);
        }
        return [];
    }

    private async readAndUpdateSingleRecord(column: string, query: {}, update: {}): Promise<any> {
        try {
            const start = Date.now();
            const col = await this.getCollection(column);

            const record: any = await (col as any).findOneAndUpdate(query, update);

            if (record === null) {
                return null;
            } else {
                delete record._id;
                return record;
            }
        } catch (err) {
            Log.error("DatabaseController::readAndUpdateSingleRecord(..) - ERROR: " + err);
            return null;
        }
    }

    /**
     * Internal use only, do not use this method; use getCollection(..) instead.
     *
     * @returns {Promise<Db>}
     */
    private async open(): Promise<Db> {
        try {
            // Log.trace("DatabaseController::open() - start");
            if (this.db === null) {

                // just use Config.name for the db (use a test org name if you want to avoid tests wiping data!!)
                let dbName = Config.getInstance().getProp(ConfigKey.name).trim(); // make sure there are no extra spaces in config
                const dbHost = Config.getInstance().getProp(ConfigKey.mongoUrl).trim(); // make sure there are no extra spaces in config

                /* istanbul ignore if */
                if (dbName === 'sdmm') {
                    dbName = 'secapstone'; // NOTE: this is just an unfortunate historical artifact
                }

                // _ are to help diagnose whitespace in dbname/mongoUrl
                Log.info("DatabaseController::open() - db null; making new connection to: _" + dbName + "_ on: _" + dbHost + "_");

                const client = await MongoClient.connect(dbHost);
                this.db = await client.db(dbName);

                // ensure required records / indexes exist
                await this.initDatabase();

                Log.info("DatabaseController::open() - db null; new connection made");
            }
            // Log.trace("DatabaseController::open() - returning db");
            return this.db;
        } catch (err) {
            Log.error("DatabaseController::open() - ERROR: " + err);
            Log.error("DatabaseController::open() - ERROR: Host probably does not have a database configured " +
                "and running (see README.md if this is a test instance).");
        }
    }

    /**
     * Collect any actions that need to happen when a database is first opened.
     *
     * This can include objects or indexes that must be created.
     */
    private async initDatabase() {

        if (this.db === null) {
            throw new Error("DatabaseController::initDatabase() cannot be called before db is set");
        }

        // create indexes if they don't exist (idempotent operation; even if index exists this is ok)
        // https://stackoverflow.com/a/35020346

        // results needs a timestamp index because it gets to be too long to iterate through all records (32MB result limit)
        const coll = await this.getCollection(this.RESULTCOLL);
        await coll.createIndex({
            "input.target.timestamp": -1
        }, {name: "ts"});

        // Make sure required Team objects exist.
        // Cannot use TeamController because this would cause an infinite loop since
        // TeamController uses this code to get the database instance.
        let teamName = 'admin';
        let team = await this.getTeam(teamName);
        if (team === null) {
            const newTeam: Team = {
                id:        teamName,
                delivId:   null, // null for special teams
                githubId:  null, // to be filled in later
                URL:       null, // to be filled in later
                personIds: [], // empty for special teams
                repoName:  null, // null for special teams
                custom:    {}
            };
            await this.writeTeam(newTeam);
        }
        teamName = 'staff';
        team = await this.getTeam(teamName);
        if (team === null) {
            const newTeam: Team = {
                id:        teamName,
                delivId:   null, // null for special teams
                githubId:  null, // to be filled in later
                URL:       null, // to be filled in later
                personIds: [], // empty for special teams
                repoName:  null, // null for special teams
                custom:    {}
            };
            await this.writeTeam(newTeam);
        }
        teamName = 'students';
        team = await this.getTeam(teamName);
        if (team === null) {
            const newTeam: Team = {
                id:        teamName,
                delivId:   null, // null for special teams
                githubId:  null, // to be filled in later
                URL:       null, // to be filled in later
                personIds: [], // empty for special teams
                repoName:  null, // null for special teams
                custom:    {}
            };
            await this.writeTeam(newTeam);
        }
        await this.createTeamTicker();
    }

    public async writeAuth(record: Auth): Promise<boolean> {
        Log.info("DatabaseController::writeAuth( " + record.personId + ", ... ) - start");
        const auth = await this.readSingleRecord(this.AUTHCOLL, {personId: record.personId}) as Auth;
        if (auth === null) {
            return await this.writeRecord(this.AUTHCOLL, record);
        } else {
            const query = {personId: record.personId};
            return await this.updateRecord(this.AUTHCOLL, query, record);
        }
    }

    public async getResult(delivId: string, repoId: string, sha: string): Promise<Result> {

        const results = await this.readRecords(this.RESULTCOLL, {delivId: delivId, repoId: repoId}) as Result[];
        let result = null;
        for (const res of results) {
            if (res.commitSHA === sha) {
                // there should only be one of these <delivId, SHA> tuples, but if there are more than one this will return the last one
                result = res;
            }
        }

        if (result !== null) {
            Log.info("DatabaseController::getResult( " + delivId + ", " + repoId + ", " + sha + " ) - found: " + JSON.stringify(result));
            if (typeof (result.input as any).pushInfo !== 'undefined' && typeof result.input.target === 'undefined') {
                // this is a backwards compatibility step that can disappear in 2019 (except for sdmm which will need further changes)
                result.input.target = (result.input as any).pushInfo;
            }
        } else {
            Log.info("DatabaseController::getResult( " + delivId + ", " + repoId + ", " + sha + " ) - not found");
        }
        return result;
    }

    /**
     * Gets the result for a commit and a deliverable. Only returns one record because multiple executions on the same <SHA, delivId>
     * tuple cause the db record to be updated.
     *
     * @param {string} commitURL
     * @param {string} delivId
     * @returns {Promise<Result>}
     */
    public async getResultFromURL(commitURL: string, delivId: string): Promise<Result | null> {
        const result = await this.readSingleRecord(this.RESULTCOLL, {commitURL: commitURL, delivId: delivId}) as Result;

        return result;
    }

    public async getResultsForPerson(personId: string, delivId: string): Promise<Result | null> {
        const result = await this.readSingleRecord(this.RESULTCOLL, {people: personId, delivId: delivId}) as Result;

        return result;
    }
}
