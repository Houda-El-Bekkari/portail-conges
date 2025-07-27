import { LightningElement, api, track, wire } from 'lwc';
import FullCalendarJS from '@salesforce/resourceUrl/fullcalendarv3';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';

import createRequest from '@salesforce/apex/Leave_Request_Controller.createRequest';
import updateRequest from '@salesforce/apex/Leave_Request_Controller.updateRequest';
import deleteRequest from '@salesforce/apex/Leave_Request_Controller.deleteRequest';
import getMyRequests from '@salesforce/apex/Leave_Request_Controller.getMyRequests';

import flatpickrBase from '@salesforce/resourceUrl/flatpickr';
const flatpickrJs = flatpickrBase + '/flatpickr.min.js';
const flatpickrCss = flatpickrBase + '/flatpickr.min.css';

export default class Calender extends LightningElement {
    // Component state
    jsInitialised = false;
    flatpickrInitialized = false;
    startDatePicker = null;
    endDatePicker = null;
    disabledDates = ['2025-01-01', '2025-07-14', '2025-12-25'];
    
    // Form data
    @track _events;
    @track startDate = '';
    @track endDate = '';
    @track reason = '';
    @track type = '';
    @track isLoading = false;
    @track editingRequestId = null;
    @track isEditMode = false;

    // ========== WIRE SERVICES & GETTERS ==========
    @wire(getObjectInfo, { objectApiName: 'Leave_Request__c' })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: 'Leave_Request__c.Type__c'
    })
    typePicklistValues;
    
    @wire(getMyRequests) req;

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

    get requests() {
        if (this.req.data) {
            return this.req.data.map(request => ({
                ...request,
                isPending: request.Status__c === 'Pending'
            }));
        }
        return [];
    }

    // ========== CALENDAR EVENTS API ==========
    @api
    get events() {
        return this._events;
    }
    set events(value) {
        this._events=[...value];
    }

    @api
    get eventDataString() {
        return this.events;
    }
    set eventDataString(value) {
        try {
            this.events=eval(value);
        } catch {
           this.events=[];
        }
    }

    // ========== COMPONENT LIFECYCLE ==========
    renderedCallback() {
        // Only initialize once
        if (this.jsInitialised) return;
        this.jsInitialised = true;

        // Load all required scripts and styles
        Promise.all([
            loadScript(this, FullCalendarJS + '/FullCalenderV3/jquery.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/moment.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.js'),
            loadStyle(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.css'),
            loadScript(this, flatpickrJs),
            loadStyle(this, flatpickrCss)
        ])
        .then(() => {
            this.initializeCalendar();
            this.initializeDatePickers();
        })
        .catch(error => {
            console.error('Failed to load calendar resources:', error);
            this.showToast('Error', 'Failed to load calendar', 'error');
        });
    }

    // ========== DATE PICKER INITIALIZATION ==========
    initializeDatePickers() {
        if (this.flatpickrInitialized) return;
        this.flatpickrInitialized = true;

        // Create input containers
        const startContainer = this.template.querySelector('[data-id="startDate"]');
        const endContainer = this.template.querySelector('[data-id="endDate"]');
        const startInput = document.createElement('input');
        const endInput = document.createElement('input');
        
        startInput.type = 'text';
        endInput.type = 'text';
        startContainer.appendChild(startInput);
        endContainer.appendChild(endInput);

        // Disable weekends and holidays
        const disableWeekends = (date) => (date.getDay() === 0 || date.getDay() === 6);
        const disableOptions = [disableWeekends, ...this.disabledDates];

        // Initialize flatpickr instances
        this.startDatePicker = flatpickr(startInput, {
            dateFormat: 'Y-m-d',
            onChange: (selectedDates, dateStr) => { this.startDate = dateStr; },
            disable: disableOptions
        });

        this.endDatePicker = flatpickr(endInput, {
            dateFormat: 'Y-m-d',
            onChange: (selectedDates, dateStr) => { this.endDate = dateStr; },
            disable: disableOptions
        });
    }

    // ========== CALENDAR INITIALIZATION ==========
    initializeCalendar() { 
        const calendarElement = this.template.querySelector('div.fullcalendarjs');
        const self = this;

        $(calendarElement).fullCalendar({
            // Calendar configuration
            header: {
                left: 'prev,next today',
                center: 'title',
                right: 'month,basicWeek,basicDay'
            },
            defaultDate: new Date(),
            navLinks: true, 
            editable: true,
            eventLimit: true,
            events: this.events,
            dragScroll: true,
            droppable: true,
            weekNumbers: true,
            selectable: true,
            
            // Selection constraints
            selectConstraint: { dow: [1, 2, 3, 4, 5] }, // Monday to Friday only
            selectAllow: function(selectInfo) {
                const day = selectInfo.start.day();
                const dateStr = selectInfo.start.format('YYYY-MM-DD');
                
                // Block weekends and holidays
                if (day === 0 || day === 6) return false;
                if (self.disabledDates.includes(dateStr)) return false;
                
                return true;
            },
            
            // Style weekends and holidays
            dayRender: function(date, cell) {
                const dateStr = date.format('YYYY-MM-DD');
                const isWeekend = (date.day() === 0 || date.day() === 6);
                const isHoliday = self.disabledDates.includes(dateStr);
                
                if (isWeekend || isHoliday) {
                    cell.css({
                        'background-color': '#f3f3f3',
                        'color': '#666',
                        'cursor': 'not-allowed'
                    });
                    cell.addClass(isWeekend ? 'weekend-cell' : 'disabled-date');
                }
            },
            
            // Handle date selection
            select: function(start, end) {
                self.handleDateSelection(start, end);
            },
            
            // Handle event clicks
            eventClick: function (info) {
                const selectedEvent = new CustomEvent('eventclicked', { detail: info.Id });
                self.dispatchEvent(selectedEvent);
            }
        });
    }

    // ========== EVENT HANDLERS ==========
    handleDateSelection(start, end) {
        // Update form with selected date range
        this.startDate = start.format('YYYY-MM-DD');
        this.endDate = end.subtract(1, 'day').format('YYYY-MM-DD'); // FullCalendar end is exclusive
        
        // Sync with date pickers
        if (this.startDatePicker) this.startDatePicker.setDate(this.startDate, false);
        if (this.endDatePicker) this.endDatePicker.setDate(this.endDate, false);
    }

    handleReasonChange(event) {
        this.reason = event.target.value;
    }

    handleTypeChange(event) {
        this.type = event.target.value;
    }

    // ========== FORM SUBMISSION ==========
    handleSubmit() {
        // Validate dates
        if (new Date(this.startDate) > new Date(this.endDate)) {
            this.showToast('Error', 'Start date cannot be after end date', 'error');
            return;
        }
        if (new Date(this.startDate) < new Date()) {
            this.showToast('Error', 'Start date cannot be in the past', 'error');
            return;
        }

        this.isLoading = true;

        // Prepare request data
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

        // Submit request
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

    // ========== REQUEST MANAGEMENT ==========
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

    // ========== UTILITY METHODS ==========
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
}