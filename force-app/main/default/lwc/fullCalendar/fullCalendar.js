import { LightningElement, api, track, wire } from 'lwc';
import FullCalendarJS from '@salesforce/resourceUrl/fullcalendarv3';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';

import createRequest from '@salesforce/apex/Leave_Request_Controller.createRequest';
import getHolidays from '@salesforce/apex/HolidayService.getHolidays';
import getHolidays_MA from '@salesforce/apex/HolidayService.getHolidays_MA';
import updateRequest from '@salesforce/apex/Leave_Request_Controller.updateRequest';
import deleteRequest from '@salesforce/apex/Leave_Request_Controller.deleteRequest';
import getMyRequests from '@salesforce/apex/Leave_Request_Controller.getMyRequests';
import approveRequest from '@salesforce/apex/Leave_Request_Controller.approveRequest';

import flatpickrBase from '@salesforce/resourceUrl/flatpickr';
const flatpickrJs = flatpickrBase + '/flatpickr.min.js';
const flatpickrCss = flatpickrBase + '/flatpickr.min.css';

export default class Calender extends LightningElement {
    // Component state
    jsInitialised = false;
    flatpickrInitialized = false;
    startDatePicker = null;
    endDatePicker = null;
    @track disabledDates = [];
    @track holidayLabels = {};


    // Method to fetch holidays from the API
    // Method to fetch holidays from the API
async fetchHolidays() {
    try {
        const data = await getHolidays_MA(); // [{ date: '2025-01-01', name: 'Nouvel An' }, ...]
        console.log('Fetched holidays:', data);

        // Stocker les noms avec les dates
        this.disabledDates = data.map(item => item.date);
        this.holidayLabels = data.reduce((acc, item) => {
            acc[item.date] = item.name;
            return acc;
        }, {});
    } catch (error) {
        console.error("Error fetching holidays:", error);
        this.showToast("Error", "Failed to load holidays", "error");
    }
}

handleApprove(event) {
    const requestId = event.target.dataset.id;

    approveRequest({ requestId })
        .then(() => {
            this.showToast('Succès', 'Demande approuvée et solde mis à jour.', 'success');
            return refreshApex(this.req);
        })
        .catch(error => {
            this.showToast('Erreur', error.body?.message || 'Erreur d’approbation', 'error');
        });
}

    
    // Form data
    @track _events;
    @track startDate = '';
    @track endDate = '';
    @track reason = '';
    @track type = '';
    @track isLoading = false;
    @track editingRequestId = null;
    @track isEditMode = false;
    @track requestsData = []; // Track requests data separately

    // ========== WIRE SERVICES & GETTERS ==========
    @wire(getObjectInfo, { objectApiName: 'Leave_Request__c' })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: 'Leave_Request__c.Type__c'
    })
    typePicklistValues;
    
    @wire(getMyRequests) 
    wiredRequests(result) {
        this.req = result;
        if (result.data) {
            // Update tracked property to force re-render
            this.requestsData = result.data.map(request => ({
                ...request,
                isPending: request.Status__c === 'Pending'
            }));
            this.refreshCalendarEvents();
        } else if (result.error) {
            console.error('Error loading requests:', result.error);
            this.requestsData = [];
        }
    }

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
        return this.requestsData;
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
    if (this.jsInitialised) return;
    this.jsInitialised = true;

    Promise.all([
        loadScript(this, FullCalendarJS + '/FullCalenderV3/jquery.min.js'),
        loadScript(this, FullCalendarJS + '/FullCalenderV3/moment.min.js'),
        loadScript(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.js'),
        loadStyle(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.css'),
        loadScript(this, flatpickrJs),
        loadStyle(this, flatpickrCss)
    ])
    .then(async () => {
        await this.fetchHolidays(); // 👈 Important : attendre les dates fériées
        this.initializeCalendar();  // 👈 Ensuite on initialise
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

        // Disable weekends and holidays
        const disableWeekends = (date) => (date.getDay() === 0 || date.getDay() === 6);
        const holidayDatesForFlatpickr = this.disabledDates.map(dateStr => new Date(dateStr));
        const disableOptions = [disableWeekends, ...holidayDatesForFlatpickr];

        // Create both date pickers
        this.startDatePicker = this.createDatePicker('startDate', (dateStr) => { this.startDate = dateStr; }, disableOptions);
        this.endDatePicker = this.createDatePicker('endDate', (dateStr) => { this.endDate = dateStr; }, disableOptions);
    }

    // Helper method to create a date picker
    createDatePicker(containerId, onChangeCallback, disableOptions) {
        const container = this.template.querySelector(`[data-id="${containerId}"]`);
        const input = document.createElement('input');
        input.type = 'text';
        container.appendChild(input);

        return flatpickr(input, {
            dateFormat: 'Y-m-d',
            onChange: (selectedDates, dateStr) => onChangeCallback(dateStr),
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
            events: [], // Start with empty events, will be populated later
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

        // Ajoute un label s’il y a un nom de jour férié
        const label = self.holidayLabels[dateStr];
        if (label) {
            const labelElement = document.createElement('div');
            labelElement.textContent = label;
            labelElement.style.fontSize = '0.7rem';
            labelElement.style.marginTop = '3px';
            labelElement.style.color = '#b30000';
            cell.append(labelElement);
        }
    }
},
            
            // Handle date selection
            select: function(start, end) {
                self.handleDateSelection(start, end);
            },
            
            // Handle event clicks
            eventClick: function (calEvent, jsEvent, view) {
                // Show request details when clicking on a request event
                self.handleRequestEventClick(calEvent);
            }
        });
        
        // Load initial events after calendar is created
        this.loadCalendarEvents();
    }

    // Convert leave requests to calendar events
    getCalendarEvents() {
        if (!this.requests || this.requests.length === 0) return [];
        
        return this.requests.map(request => {
            // Determine color based on leave type
            let color = this.getColorForType(request.Type__c);
            
            // Add opacity based on status (optional - for additional visual feedback)
            let backgroundColor = color;
            let borderColor = color;
            
            switch(request.Status__c) {
                case 'Approved':
                    // Keep full opacity for approved
                    break;
                case 'Rejected':
                    // Darker border for rejected
                    borderColor = '#000000';
                    backgroundColor = color + '80'; // Add transparency
                    break;
                case 'Pending':
                    // Dashed border for pending (will be handled in CSS)
                    break;
            }

            return {
                id: request.Id,
                title: `${request.Type__c || 'Leave'} - ${request.Status__c}`,
                start: request.Start_Date__c,
                end: this.addDaysToDate(request.End_Date__c, 1), // FullCalendar end is exclusive
                color: backgroundColor,
                borderColor: borderColor,
                allDay: true,
                requestData: request, // Store original request data
                className: `status-${request.Status__c?.toLowerCase() || 'unknown'}` // CSS class for additional styling
            };
        });
    }

    // Get color based on leave type
    getColorForType(type) {
        const typeColors = {
            'Sick Leave': '#dc3545',
            'Training Leave': '#28a745',
            'Vacation': '#17a2b8',

        };

        return typeColors[type] || '#6c757d'; // Default gray
    }

    // Helper method to add days to a date string
    addDaysToDate(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    // Handle clicking on request events
    handleRequestEventClick(calEvent) {
        const request = calEvent.requestData;
        const message = `
            Type: ${request.Type__c || 'N/A'}
            Dates: ${request.Start_Date__c} to ${request.End_Date__c}
            Status: ${request.Status__c}
            ${request.Reason__c ? 'Reason: ' + request.Reason__c : ''}
        `;
        
        this.showToast('Leave Request Details', message, 'info');
    }

    // Load initial calendar events
    loadCalendarEvents() {
        const calendarElement = this.template.querySelector('div.fullcalendarjs');
        if (calendarElement && $(calendarElement).fullCalendar) {
            const events = this.getCalendarEvents();
            $(calendarElement).fullCalendar('addEventSource', events);
        }
    }

    // Refresh calendar events when requests change
    refreshCalendarEvents() {
        const calendarElement = this.template.querySelector('div.fullcalendarjs');
        if (calendarElement && $(calendarElement).fullCalendar) {
            // Remove all existing events
            $(calendarElement).fullCalendar('removeEvents');
            // Add updated events
            const events = this.getCalendarEvents();
            if (events && events.length > 0) {
                $(calendarElement).fullCalendar('addEventSource', events);
            }
            // Ensure calendar remains selectable
            $(calendarElement).fullCalendar('option', 'selectable', true);
        }
    }

    // Centralized method to refresh all data
    async refreshData() {
        await refreshApex(this.req);
        this.refreshCalendarEvents();
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
    async handleSubmit() {
        // Validate dates
        if (!this.validateDates()) return;

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
        try {
            await operation({ request: leaveRequest });
            this.showToast('Success', this.isEditMode ? 'Request updated' : 'Request submitted', 'success');
            this.resetForm();
            return refreshApex(this.req);
        } catch (error) {
            this.showToast('Error', error.body?.message || 'Operation failed', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // Validate form dates
    validateDates() {
        const startDate = new Date(this.startDate);
        const endDate = new Date(this.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time for comparison

        // Basic date validations
        if (startDate > endDate) {
            this.showToast('Error', 'Start date cannot be after end date', 'error');
            return false;
        }

        if (startDate < today) {
            this.showToast('Error', 'Start date cannot be in the past', 'error');
            return false;
        }

        // Check for overlapping requests
        const hasOverlap = this.requests.some(req => {
            if (this.isEditMode && req.Id === this.editingRequestId) return false;
            
            const reqStart = new Date(req.Start_Date__c);
            const reqEnd = new Date(req.End_Date__c);
            
            return (startDate >= reqStart && startDate <= reqEnd) ||
                   (endDate >= reqStart && endDate <= reqEnd) ||
                   (startDate <= reqStart && endDate >= reqEnd);
        });

        if (hasOverlap) {
            this.showToast('Error', 'Leave dates overlap with an existing request', 'error');
            return false;
        }

        return true;
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
            .then(() => {
                // Force update of tracked property
                if (this.req && this.req.data) {
                    this.requestsData = this.req.data.map(request => ({
                        ...request,
                        isPending: request.Status__c === 'Pending'
                    }));
                }
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