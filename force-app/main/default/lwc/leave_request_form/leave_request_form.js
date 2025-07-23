import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import createRequest from '@salesforce/apex/Leave_Request_Controller.createRequest';
import updateRequest from '@salesforce/apex/Leave_Request_Controller.updateRequest';
import getRequests from '@salesforce/apex/Leave_Request_Controller.getRequests';
import deleteRequest from '@salesforce/apex/Leave_Request_Controller.deleteRequest';
import getRequest from '@salesforce/apex/Leave_Request_Controller.getRequest';

export default class Leave_request_form extends LightningElement {
    @track startDate = '';
    @track endDate = '';
    @track reason = '';
    @track type = '';
    @track isLoading = false;
    @track editingRequestId = null;
    @track isEditMode = false;

    @wire(getObjectInfo, { objectApiName: 'Leave_Request__c' })
    objectInfo;

    // Wire to get picklist values for Type field
    @wire(getPicklistValues, { 
        recordTypeId: '$objectInfo.data.defaultRecordTypeId', 
        fieldApiName: 'Leave_Request__c.Type__c' 
    })
    typePicklistValues;

    // Options for leave type combobox - now dynamically loaded from Salesforce
    get typeOptions() {
        if (this.typePicklistValues.data) {
            return this.typePicklistValues.data.values.map(picklistValue => ({
                label: picklistValue.label,
                value: picklistValue.value
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

    handleStartDateChange(event) {
        this.startDate = event.target.value;
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
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

        // Add Id if we're in edit mode
        if (this.isEditMode && this.editingRequestId) {
            leaveRequest.Id = this.editingRequestId;
        }

        const operation = this.isEditMode ? updateRequest : createRequest;
        const operationName = this.isEditMode ? 'updated' : 'created';

        operation({ request: leaveRequest })
            .then(result => {
                console.log(`Leave request ${operationName} successfully:`, result);
                this.showToast('Success', `Leave request ${operationName} successfully`, 'success');
                this.resetForm();
                return refreshApex(this.req);
            })
            .catch(error => {
                console.error(`Error ${operationName.slice(0, -1)}ing leave request:`, error);
                this.showToast('Error', error.body ? error.body.message : 'An error occurred', 'error');
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
        } else {
            this.showToast('Error', 'Only pending requests can be edited', 'error');
        }
    }

    handleCancelEdit() {
        this.resetForm();
    }

    handleCancel(event) {
        const requestId = event.target.dataset.id;
        
        deleteRequest({ requestId: requestId })
            .then(() => {
                this.showToast('Success', 'Leave request cancelled successfully', 'success');
                return refreshApex(this.req);
            })
            .catch(error => {
                this.showToast('Error', error.body?.message || 'Error cancelling request', 'error');
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
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
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