/**
 * This is the main student page for CS340.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsButtonElement, OnsModalElement, OnsPageElement, OnsSelectElement, OnsToastElement} from "onsenui";
import Log from "../../../../../common/Log";
import {UI} from "../../util/UI";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    SubQuestionGradingRubric
} from "../../../../../common/types/CS340Types";

import {IView} from "../IView";
import {Deliverable, Grade, Person} from "../../../../../portal-backend/src/Types";
import {Factory} from "../../Factory";
import {SortableTable, TableHeader} from "../../util/SortableTable";


export class CS340View implements IView {
    private remote: string = null;

    constructor(remoteUrl: string) {
        Log.info("CS340View::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CS340View::renderPage() - start; opts: ' + JSON.stringify(opts));
        let opsObject : any = opts;
        if(opsObject.page !== null) {
            console.log("got a non-null page value");
            if(opsObject.page === "cs340/gradingView.html") {
                // do stuff
                console.log("got into grading");
                this.populateGradingPage("a1", "jopika").then((result) => {
                    Log.info("CS340View::renderPage() - finished populating");
                });
            }
        }
    }

    public testfunction() {
        console.log("A spooky message!");
        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/gradingView.html', {
            hello:"world"
            ,page: Factory.getInstance().getHTMLPrefix() + '/gradingView.html'
        }).then(()=> {
            this.renderPage({page: Factory.getInstance().getHTMLPrefix() + '/gradingView.html'});
            console.log("all done!");
        });
    }

    private getOptions() {
        const options = {
            headers: {
                user:  localStorage.user,
                token: localStorage.token,
                org:   localStorage.org
            }
        };
        return options;
    }

    // public showModal(text?: string) {
    //     // https://onsen.io/v2/api/js/ons-modal.html
    //     if (typeof text === 'undefined') {
    //         text = null;
    //     }
    //
    //     const modal = document.querySelector('ons-modal') as OnsModalElement;
    //     if (modal !== null) {
    //         modal.style.backgroundColor = '#444444'; // modal opaque
    //         if (text != null) {
    //             document.getElementById('modalText').innerHTML = text;
    //         }
    //         modal.show({animation: 'fade'});
    //     } else {
    //         console.log('UI::showModal(..) - Modal is null');
    //     }
    // }
    //
    // public hideModal() {
    //     const modal = document.querySelector('ons-modal') as OnsModalElement;
    //     if (modal !== null) {
    //         modal.hide({animation: 'fade'});
    //     } else {
    //         console.log('UI::hideModal(..) - Modal is null');
    //     }
    // }

    public showError(failure: any) { // FailurePayload
        Log.error("SDDM::showError(..) - failure: " + JSON.stringify(failure));
        if (typeof failure === 'string') {
            UI.showAlert(failure);
        } else if (typeof failure.failure !== 'undefined') {
            UI.showAlert(failure.failure.message);
        } else {
            Log.error("Unknown message: " + JSON.stringify(failure));
            UI.showAlert("Action unsuccessful.");
        }
    }

    public async getGradingRubric(assignmentId: string): Promise<AssignmentGradingRubric | null> {
        Log.info("CS340View::getGradingRubric(" + assignmentId + ") - start");
        const url = this.remote + '/getAssignmentRubric/' + assignmentId;
        Log.info("CS340View::getGradingRubric(...) - uri: " + url);

        UI.showModal("Getting grading rubric, please wait...");
        // Call the function
        let options: any = this.getOptions();

        options.method = 'get';
        let response = await fetch(url, options);
        UI.hideModal();

        // If the response was valid:
        if (response.status === 200) {
            let jsonResponse = await response.json();
            // TODO [Jonathan]: Do something with the response
            return jsonResponse.response;
        } else {
            Log.trace('CS340View::getGradingRubric(...) - !200; Code: ' + response.status);
            return null;
        }
    }

    /**
     * Grabs the page and adds the grading view as specified in the deliverable
     * @param {string} delivId
     * @param {string} sid
     * @returns {Promise<void>}
     */
    public async populateGradingPage(delivId: string, sid : string) {
        Log.info("CS340View::populateGradingPage() - start");

        UI.showModal("Populating grading view, please wait...");
        let rubric : AssignmentGradingRubric = await this.getGradingRubric(delivId);
        if (rubric === null) {
            // Log.error(rubric);
            Log.error("CS340View::populateGradingPage() - Unable to populate page due to missing rubric");
            return;
        }
        Log.info("CS340View::populateGradingPage() - Rubric: " + rubric);

        // TODO: Do something about the previous submission
        let previousSubmission = await this.getStudentGrade(sid, delivId);

        let assignmentInfoElement = document.getElementById('assignmentInfoSection');
        let gradingSectionElement = document.getElementById('gradingSection');

        if (gradingSectionElement === null || assignmentInfoElement === null) {
            Log.error("CS340View::populateGradingPage() - Unable to populate page due to missing elements");
            return;
        }

        for (let i = 0; i < rubric.questions.length; i++) {
            // Get the i-th question
            let question = rubric.questions[i];

            let questionHeaderElement = document.createElement("h3");
            let questionHeader = document.createElement("span");
            let questionHeaderComponent1 = document.createElement("span");
            let questionHeaderComponent2 = document.createElement("span");

            // TODO: Check this
            questionHeaderComponent1.innerHTML = question.name;
            questionHeaderComponent2.setAttribute("class", "redText");
            questionHeaderComponent2.innerHTML = " *";

            questionHeader.appendChild(questionHeaderComponent1);
            questionHeader.appendChild(questionHeaderComponent2);
            questionHeaderElement.appendChild(questionHeader);
            gradingSectionElement.appendChild(questionHeaderElement);

            let questionBox = document.createElement("div");
            questionBox.setAttribute("class", "questionBox");

            for(let j = 0; j < question.subQuestions.length; j++) {
                let subQuestion : SubQuestionGradingRubric = question.subQuestions[j];

                let questionSubBoxElement = document.createElement("div");
                questionSubBoxElement.setAttribute("class", "subQuestionBody");

                // Create the grade input element
                let subInfoBoxElement = document.createElement("div");
                subInfoBoxElement.setAttribute("class", "subQuestionInfoBox");

                // Contains the feedback box for the particular subquestion
                let subTextBoxElement = document.createElement("div");
                subTextBoxElement.setAttribute("class", "subQuestionTextBox");

                let subErrorBoxElement = document.createElement("div");
                subErrorBoxElement.setAttribute("class", "subQuestionErrorBox");

                // Create the grade input element
                let gradeInputElement = document.createElement("ons-input");
                gradeInputElement.setAttribute("type", "number");
                gradeInputElement.setAttribute("placeHolder", subQuestion.name);
                gradeInputElement.setAttribute("data-type", subQuestion.name);
                gradeInputElement.setAttribute("modifier", "underbar");
                gradeInputElement.setAttribute("class", "subQuestionGradeInput");
                // gradeInputElement.setAttribute("onchange", "checkIfWarning(this)");
                gradeInputElement.setAttribute("data-outOf", "" + subQuestion.outOf);
                gradeInputElement.innerHTML = subQuestion.name + " [out of " + subQuestion.outOf + "]";

                // Add grade input to infoBox
                subInfoBoxElement.appendChild(gradeInputElement);

                // Create error box that is initially invisible
                let errorBox = document.createElement("p");
                errorBox.setAttribute("class", "errorBox");

                // Add the error box to the info box section
                subInfoBoxElement.appendChild(errorBox);

                // Create input form for feedback form
                let textBoxElement = document.createElement("textArea");
                let textBoxLabelElement = document.createElement("p");
                textBoxLabelElement.innerHTML = "Comments & Feedback";
                textBoxLabelElement.setAttribute("class", "textboxLabel");
                textBoxElement.setAttribute("class", "textarea");
                textBoxElement.setAttribute("style", "width: 100%;height: 75%; min-width: 100px;min-height: 50px");
                subTextBoxElement.appendChild(textBoxLabelElement);
                subTextBoxElement.appendChild(textBoxElement);

                // Add two subboxes to the subQuestion box
                questionSubBoxElement.appendChild(subInfoBoxElement);
                questionSubBoxElement.appendChild(subTextBoxElement);

                // Add the subQuestion to the question box
                questionBox.appendChild(questionSubBoxElement);
            }

            // Add the questionBox to the gradingSection
            gradingSectionElement!.appendChild(questionBox);
        }

        // TODO: Work on this
        // Create a submission button
        let submitButton = document.createElement("ons-button");
        // TODO: Link this better
        submitButton.setAttribute("onclick", "submitGrades()");
        submitButton.innerHTML = "Submit";

        gradingSectionElement!.appendChild(submitButton);
    }

    public async getStudentGrade(sid: string, aid: string): Promise<AssignmentGrade | null> {
        // TODO [Jonathan]: Complete this
        return null;
    }

    public async pageSetup() {
        Log.info("CS340View::pageSetup - Setting up page with default dropdowns");

    }


    public async renderDeliverables() {
        // TODO [Jonathan]: Get the deliverables
        Log.info("CS340View::getAllDeliverables() - start");
        const url = this.remote + '/getAllDeliverables';
        UI.showModal("Getting all deliverables, please wait...");

        let options: any = this.getOptions();
        options.method = 'get';
        let response = await fetch(url, options);
        UI.hideModal();
        Log.info("CS340View::getAllDeliverables() - response recieved");

        if (response.status === 200) {
            // console.log("This is the result received: ");
            let jsonResponse = await response.json();
            let responseData = jsonResponse.response;

            // console.log(jsonResponse);

            let deliverableListElement = document.getElementById("select-deliverable-list") as OnsSelectElement;
            while (deliverableListElement.firstChild) {
                deliverableListElement.removeChild(deliverableListElement.firstChild);
                // deliverableListElement.remove();
            }
            let arrayResponse: Deliverable[] = responseData.result;
            // Log.info("CS340View::getAllDeliverables() value- " + JSON.stringify(arrayResponse));
            // Log.info("CS340View::getAllDeliverables() value- " + arrayResponse);
            if (arrayResponse == null || typeof arrayResponse == "undefined") {
                return;
            }
            for (const deliv of arrayResponse) {
                // let newOption = document.createElement("ons-list-item");
                let newOption = document.createElement("option");
                // newOption.setAttribute("tappable", "true");
                newOption.setAttribute("value", "material");
                newOption.text = deliv.id;
                newOption.value = deliv.id;
                // TODO [Jonathan]: Make this call the page transition function
                // newOption.setAttribute("onclick", "window.classportal.view.changeStudentList(\""+deliv.id+"\")");
                // selectElement.appendChild(newOption);
                (<any>deliverableListElement).appendChild(newOption);
            }
            // TODO [Jonathan]: Setup an event listener on the button to show the grades
            let deliverableButton = document.getElementById("select-deliverable-button") as OnsButtonElement;
            deliverableButton.addEventListener('click', () => {
                let selectedDeliverable = deliverableListElement.options[deliverableListElement.options.selectedIndex].value;
                // Log.info("CS340View::clickListener - value: " + selectedDeliverable);
                this.renderStudentSubmissions(selectedDeliverable);
            });
        } else {
            Log.info("CS340View::getAllDeliverables() - Error: unable to retrieve deliverables");
            // return null;
        }

        Log.info("CS340View::getAllDeliverables() - end");
    }

// <<<<<<< HEAD
    public async renderStudentSubmissions(delivId : string) {
        Log.info("CS340View::renderStudentSubmissions("+delivId+") -- start");
        let gradeTable = document.getElementById("grades-table");
        const submissionRetrieveURL = this.remote + '/getAllSubmissionsByDelivID/' + delivId;

        UI.showModal("Loading submissions, please wait...");
        let options: any = this.getOptions();
        options.method = 'get';
        let response = await fetch(submissionRetrieveURL, options);

        if (response.status === 200) {
            let jsonResponse = await response.json();
            let responseData = jsonResponse.response; // TODO: Check if this is null

            if (gradeTable !== null) {
                gradeTable.innerHTML = ''; // destructively delete the table entries
                let headerValues = ['Username', 'SNum', 'First', 'Last'];

                headerValues.push(delivId); // Append the deliverable ID to the end of the header
                let delivCount = 1; // Constant: Change if dynamic

                let headers: TableHeader[] = [];
                let defaultSort = true; // Set true for first value
                for(let h of headerValues) {
                    headers.push({id: h, text: h, sortable: true, defaultSort: defaultSort, sortDown:true});
                    defaultSort = false;
                }

                // Get all students and their associated information, then store in a map for constant time access
                const url = this.remote + '/getAllPersons';
                let options : any = this.getOptions();
                options.method = 'get';
                let response = await fetch(url, options);

                if(response.status !== 200) {
                    // Fail, unable to join person data
                    Log.trace("CS340View::renderStudentSubmissions - unable to join person data; code: " + response.status);
                    return;
                }

                let jsonResponse = await response.json();
                const personData : Person[] = jsonResponse.response;

                if(personData === null) {
                    Log.trace("CS340View::renderStudentSubmissions - unable to parse person data");
                }

                // Person Lookup mapping, for close to constant lookups
                let personIdMap : {[s:string] : Person} = {};
                for(const person of personData) {
                    if(typeof personIdMap[person.id] === 'undefined') {
                        personIdMap[person.id] = person;
                    }
                }


                let table = new SortableTable(headers, "grades-table");
            }
        } else {
            Log.info("CS340View::renderStudentSubmissions - error; backend api response code: " + response.status);
        }
// =======
//     public async changeStudentList(delivId: string) {
//         console.log(delivId);
//
//         const nav = document.querySelector('#myNavigator') as any;
//         let page = nav.pushPage(Factory.getInstance().getHTMLPrefix() + "/deliverableView.html", {
//             delivId: delivId
//         });
//
//         Log.info("CS340View::renderStudentSubmission() -- Complete");
//         console.log("data: "+ JSON.stringify(nav.topPage.data));
//         // console.log();
// >>>>>>> 6485a394b8e4acf9036fc5e5c2b3121698aa8cee
    }

    // Takes the data, and removes unnecessary data based on the delivId string, and returns a filtered Grade Array
    private processGradeTableData(data: Grade[], delivId: string) : Grade[]{
        let returnArray : Grade[] = [];
        for(const grade of data) {
            if(grade.delivId === delivId || delivId === "all") {
                returnArray.push(grade);
            }
        }
        return returnArray;
    }

/*
    // Using the submission data (grades), join the data with student and deliverable information
    private async processData(data: Grade[], delivId: string) {

        Log.info("CS340View::processResponse - start");
        const url = this.remote + '/getAllPersons';
        let options : any = this.getOptions();
        options.method = 'get';
        let response = await fetch(url, options);

        if(response.status !== 200) {
            // Fail, unable to join person data
            Log.trace("CS340View::processResponse - unable to join person data; code: " + response.status);
            return;
        }

        let jsonResponse = await response.json();
        const personData : Person[] = jsonResponse.response;

        if(personData === null) {
            Log.trace("CS340View::processResponse - unable to parse person data");
        }

        // Person Lookup mapping, for close to constant lookups
        let personIdMap : {[s:string] : Person} = {};
        for(const person of personData) {
            if(typeof personIdMap[person.id] === 'undefined') {
                personIdMap[person.id] = person;
            }
        }

        // let students : Map<string,String[]> = new Map<string, String[]>();
        let students : {[s: string]: any} = {};
        let delivNamesMap : {[s: string]: string} = {};

        // Prepare student map and deliverable map data
        for (var row of data) {
            let personId = row.personId;

            const deliverable = row.delivId;

            // Create a new array for the given personId
            if (typeof students[personId] === 'undefined') {
                students[personId] = [];                            // get ready for grades
            }

            if (this.includeRecord(row, delivId)) {
                // not captured yet
                if (typeof delivNamesMap[deliverable] === 'undefined') {
                    delivNamesMap[deliverable] = deliverable;
                }
            }
        }

        // Basic sorting function based on strings
        const stringSort = function (a: string, b: string) {
            return (a.localeCompare(b));
        };

        // Sort the deliverables list
        let delivKeys = Object.keys(delivNamesMap).sort(stringSort);

        let headers = ['ID', 'SNUM', 'First', 'Last'];

        headers = headers.concat(delivKeys);

        students['_index'] = headers;

        // UPDATE: At this point, we have all the headers in the Array that will be appended to the Table
        for (let row of data) {
            if (this.includeRecord(row, delivId)) {
                if(typeof personIdMap[row.personId] === 'undefined') {
                    Log.trace("CS340View::processResponse - error; something is wrong with the data");
                    continue;
                }

                const username = personIdMap[row.personId].githubId;
                const deliverable = row.delivId;
                const student = students[username];
                const grade = row.score === null ? '' : row.score;
                const index = delivKeys.indexOf(deliverable);

                student.snum = personIdMap[row.personId].studentNumber;
                student.fname = personIdMap[row.personId].fName;
                student.lname = personIdMap[row.personId].lName;
                student.username = personIdMap[row.personId].githubId;

                if (typeof student.grades === 'undefined') {
                    student.grades = [];
                }

                // Gets an action-clickable-comment if a comment exists in the Grade object.
                let htmlNoComment: string = grade;
                let htmlComment: string = '<a class="adminGradesView__comment" href="#" data-comment="' + row.comments + '">' + grade + '</a>';
                let html: string = row.comments === '' ? htmlNoComment : htmlComment;

                student.grades[index] = {
                    value: grade,
                    html:  html
                };

                // row.delivDetails // UNUSED right now
            }
        }

        // console.log('grade data processed: ' + JSON.stringify(students));
        return students;
    }*/



    // Helper to decide if record should be included in table
    private includeRecord(data: Grade, delivId: string) : boolean {
        if(delivId === "all" ||  data.delivId === delivId) {
            return true;
        }
        return false;
    }

}