import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';

import createRequest from '@salesforce/apex/Leave_Request_Controller.createRequest';
import updateRequest from '@salesforce/apex/Leave_Request_Controller.updateRequest';
import getRequests from '@salesforce/apex/Leave_Request_Controller.getRequests';
import deleteRequest from '@salesforce/apex/Leave_Request_Controller.deleteRequest';

import flatpickrBase from '@salesforce/resourceUrl/flatpickr';
const flatpickrJs = flatpickrBase + '/flatpickr.min.js';
const flatpickrCss = flatpickrBase + '/flatpickr.min.css';

import { loadScript, loadStyle } from 'lightning/platformResourceLoader';

export default class Leave_request_form extends LightningElement {
    @track startDate = '';
    @track endDate = '';
    @track reason = '';
    @track type = '';
    @track isLoading = false;
    @track editingRequestId = null;
    @track isEditMode = false;

    flatpickrInitialized = false;

    @wire(getObjectInfo, { objectApiName: 'Leave_Request__c' })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: 'Leave_Request__c.Type__c'
    })
    typePicklistValues;

    get typeOptions() {
        if (this.typePicklistValues.data) {
            return this.typePicklistValues.data.values.map(p => ({
                label: p.label,
                value: p.value
            }));
        }
        return [];
    }

    get formTitle() {
        return this.isEditMode ? 'Edit Leave Request' : 'Leave Request Form';
    }

    get submitButtonLabel() {
        return this.isEditMode ? 'Update Request' : 'Submit Request';
    }

    renderedCallback() {
        if (this.flatpickrInitialized) return;
        this.flatpickrInitialized = true;

        Promise.all([
            loadScript(this, flatpickrJs),
            loadStyle(this, flatpickrCss)
        ])
        .then(() => {
            const startContainer = this.template.querySelector('[data-id="startDate"]');
            const endContainer = this.template.querySelector('[data-id="endDate"]');

            const startInput = document.createElement('input');
            const endInput = document.createElement('input');

            startInput.type = 'text';
            endInput.type = 'text';

            startContainer.appendChild(startInput);
            endContainer.appendChild(endInput);

            const disableDates = [
                '2025-01-01', '2025-07-14', '2025-12-25'
            ];

            const disableWeekends = (date) => {
                return (date.getDay() === 0 || date.getDay() === 6);
            };

            flatpickr(startInput, {
                dateFormat: 'Y-m-d',
                onChange: (selectedDates, dateStr) => {
                    this.startDate = dateStr;
                },
                disable: [disableWeekends, ...disableDates]
            });

            flatpickr(endInput, {
                dateFormat: 'Y-m-d',
                onChange: (selectedDates, dateStr) => {
                    this.endDate = dateStr;
                },
                disable: [disableWeekends, ...disableDates]
            });
        })
        .catch(error => {
            console.error('Erreur de chargement Flatpickr', error);
        });
    }

    handleReasonChange(event) {
        this.reason = event.target.value;
    }

    handleTypeChange(event) {
        this.type = event.target.value;
    }

    handleSubmit() {
        if (new Date(this.startDate) > new Date(this.endDate)) {
            this.showToast('Error', 'Start date cannot be after end date', 'error');
            return;
        }

        this.isLoading = true;

        const leaveRequest = {
            sobjectType: 'Leave_Request__c',
            Start_Date__c: this.startDate,
            End_Date__c: this.endDate,
            Reason__c: this.reason,
            Type__c: this.type
        };

        if (this.isEditMode && this.editingRequestId) {
            leaveRequest.Id = this.editingRequestId;
        }

        const operation = this.isEditMode ? updateRequest : createRequest;

        operation({ request: leaveRequest })
            .then(() => {
                this.showToast('Success', 'Request submitted', 'success');
                this.resetForm();
                return refreshApex(this.req);
            })
            .catch(error => {
                this.showToast('Error', error.body?.message || 'Submission failed', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleEdit(event) {
        const requestId = event.target.dataset.id;
        const request = this.requests.find(req => req.Id === requestId);

        if (request && request.Status__c === 'Pending') {
            this.isEditMode = true;
            this.editingRequestId = requestId;
            this.startDate = request.Start_Date__c;
            this.endDate = request.End_Date__c;
            this.reason = request.Reason__c || '';
            this.type = request.Type__c || '';
        }
    }

    handleCancelEdit() {
        this.resetForm();
    }

    handleCancel(event) {
        const requestId = event.target.dataset.id;
        deleteRequest({ requestId })
            .then(() => {
                this.showToast('Success', 'Request cancelled', 'success');
                return refreshApex(this.req);
            })
            .catch(error => {
                this.showToast('Error', error.body?.message || 'Cancel failed', 'error');
            });
    }

    resetForm() {
        this.startDate = '';
        this.endDate = '';
        this.reason = '';
        this.type = '';
        this.isEditMode = false;
        this.editingRequestId = null;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    @wire(getRequests) req;

    get requests() {
        if (this.req.data) {
            return this.req.data.map(request => ({
                ...request,
                isPending: request.Status__c === 'Pending'
            }));
        }
        return [];
    }
}