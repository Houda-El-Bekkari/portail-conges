import { LightningElement, api, track, wire } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';

import getHolidays_MA from '@salesforce/apex/HolidayService.getHolidays_MA';

import createRequest from '@salesforce/apex/Leave_Request_Controller.createRequest';
import updateRequest from '@salesforce/apex/Leave_Request_Controller.updateRequest';
import deleteRequest from '@salesforce/apex/Leave_Request_Controller.deleteRequest';
import getMyRequests from '@salesforce/apex/Leave_Request_Controller.getMyRequests';

import getSolde from '@salesforce/apex/Leave_Request_Controller.getSolde';
import getDeltaSolde from '@salesforce/apex/Leave_Request_Controller.getDeltaSolde';

import FullCalendarJS from '@salesforce/resourceUrl/fullcalendarv3';
import flatpickrBase from '@salesforce/resourceUrl/flatpickr';
const flatpickrJs = flatpickrBase + '/flatpickr.min.js';
const flatpickrCss = flatpickrBase + '/flatpickr.min.css';

export default class Calender extends LightningElement {
    // Component state
    jsInitialised = false;
    flatpickrInitialized = false;
    calendarInitialized = false; // Add this missing flag
    startDatePicker = null;
    endDatePicker = null;
    
    @track holidays = [];
    @track holidaysLoaded = false;

    @track userBalance = 0;

    @track deltaSolde = 0;
    async updateDeltaSolde() {
        if (!this.startDate || !this.endDate) return 0;
        this.deltaSolde = await getDeltaSolde({ startDate: this.startDate, endDate: this.endDate })
            .then(result => result)
            .catch(() => 0);
    }

    get isBalanceSufficient() {
        return this.userBalance >= this.deltaSolde && this.deltaSolde > 0;
    }

    // Update the wiredHolidays method - add more debugging
    @wire(getHolidays_MA)
    wiredHolidays(result) {
        console.log('wiredHolidays called:', result);
        this.holidaysWire = result;
        if (result.data) {
            console.log('Holiday records received:', result.data);
            console.log('Holiday count:', result.data.length);
            console.log('Sample holiday structure:', JSON.stringify(result.data[0], null, 2));
            
            // Check each holiday's date format
            result.data.forEach((holiday, index) => {
                console.log(`Holiday ${index}:`, {
                    Id: holiday.Id,
                    Name: holiday.Name,
                    Date__c: holiday.Date__c,
                    dateType: typeof holiday.Date__c
                });
            });
            
            this.holidays = result.data;
            this.holidaysLoaded = true;
            
            if (this.jsInitialised && !this.calendarInitialized) {
                console.log('Both scripts and holidays loaded - initializing calendar');
                this.initializeCalendar();
                this.initializeDatePickers();
            } else if (this.calendarInitialized) {
                // If calendar is already initialized, refresh events
                console.log('Calendar already initialized, refreshing events');
                this.refreshCalendarEvents();
            }
        } else if (result.error) {
            console.error('Error loading holidays:', result.error);
            this.holidays = [];
            this.holidaysLoaded = true; // Still set to true to allow calendar initialization
        }
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

    // Add this wire method
    @wire(getSolde)
    wiredUserBalance({ error, data }) {
        if (data !== undefined) {
            this.userBalance = data;
        } else if (error) {
            console.error('Error fetching user balance:', error);
            this.userBalance = 0;
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

        // Add custom CSS for holiday events
        const style = document.createElement('style');
        style.textContent = `
            .holiday-event {
                opacity: 0.8 !important;
                font-weight: bold !important;
            }
            .holiday-label {
                pointer-events: none;
                z-index: 1;
            }
            .weekend-cell {
                opacity: 0.6;
            }
            .holiday-cell {
                position: relative;
            }
        `;
        document.head.appendChild(style);

        console.log('Loading scripts...');
        Promise.all([
            loadScript(this, FullCalendarJS + '/FullCalenderV3/jquery.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/moment.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.js'),
            loadStyle(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.css'),
            loadScript(this, flatpickrJs),
            loadStyle(this, flatpickrCss)
        ])
            .then(() => {
                console.log('Scripts loaded. Holidays loaded?', this.holidaysLoaded, 'Calendar initialized?', this.calendarInitialized);
                if (this.holidaysLoaded && !this.calendarInitialized) {
                    console.log('Initializing calendar from renderedCallback');
                    this.initializeCalendar();
                    this.initializeDatePickers();
                }
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

        console.log('Initializing date pickers with holidays:', this.holidays);

        // Disable weekends and holidays using holidays array directly
        const disableWeekends = (date) => (date.getDay() === 0 || date.getDay() === 6);
        const disableHolidays = (date) => {
            const dateStr = date.toISOString().split('T')[0];
            return this.holidays.some(holiday => holiday.Date__c === dateStr);
        };

        const disableOptions = [disableWeekends, disableHolidays];

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
        if (this.calendarInitialized) {
            console.log('Calendar already initialized, skipping');
            return;
        }
        
        const calendarElement = this.template.querySelector('div.fullcalendarjs');
        if (!calendarElement) {
            console.error('Calendar element not found');
            return;
        }

        const self = this;
        console.log('Initializing calendar with holidays:', this.holidays.length, 'holidays');

        $(calendarElement).fullCalendar({
            header: {
                left: 'prev,next today',
                center: 'title',
                right: 'month,basicWeek,basicDay'
            },
            defaultDate: new Date(),
            navLinks: true, 
            editable: true,
            eventLimit: true,
            
            events: function(start, end, timezone, callback) {
                console.log('Events function called for range:', start.format(), 'to', end.format());
                const events = self.getCalendarEvents();
                console.log('Returning events from events function:', events);
                console.log('Holiday events:', events.filter(e => e.id && e.id.startsWith('holiday-')));
                callback(events);
            },
            
            dragScroll: true,
            droppable: true,
            weekNumbers: true,
            selectable: true,
            
            selectConstraint: { dow: [1, 2, 3, 4, 5] },
            selectAllow: function(selectInfo) {
                const day = selectInfo.start.day();
                const dateStr = selectInfo.start.format('YYYY-MM-DD');
                
                if (day === 0 || day === 6) return false;
                if (self.holidays.some(holiday => holiday.Date__c === dateStr)) {
                    return false;
                }
                
                return true;
            },
            
            dayRender: function(date, cell) {
                const dateStr = date.format('YYYY-MM-DD');
                const isWeekend = (date.day() === 0 || date.day() === 6);
                const holidayRecord = self.holidays.find(holiday => holiday.Date__c === dateStr);
                const isHoliday = !!holidayRecord;

                if (isWeekend) {
                    cell.css({
                        'background-color': '#f3f3f3',
                        'color': '#666',
                        'cursor': 'not-allowed'
                    });
                    cell.addClass('weekend-cell');
                }
                
                if (isHoliday && holidayRecord) {
                    console.log(`Applying holiday styling to ${dateStr} for:`, holidayRecord.Name);
                    cell.css({
                        'background-color': '#ffebee',
                        'color': '#c62828',
                        'cursor': 'not-allowed',
                        'font-weight': 'bold'
                    });
                    cell.addClass('holiday-cell');

                    const labelElement = document.createElement('div');
                    labelElement.textContent = holidayRecord.Name;
                    labelElement.className = 'holiday-label';
                    labelElement.style.cssText = `
                        font-size: 0.7rem;
                        margin-top: 3px;
                        color: #b71c1c;
                        font-weight: bold;
                        text-align: center;
                        line-height: 1.1;
                        word-break: break-word;
                    `;
                    cell.append(labelElement);
                }
            },
            
            select: function(start, end) {
                self.handleDateSelection(start, end);
            },
            
            eventClick: function (calEvent, jsEvent, view) {
                if (calEvent.id && calEvent.id.startsWith('holiday-')) {
                    self.showToast('Holiday', calEvent.title, 'info');
                } else {
                    self.handleRequestEventClick(calEvent);
                }
            },
            
            eventRender: function(event, element) {
                console.log('eventRender called for:', event.title, 'ID:', event.id);
                if (event.id && event.id.startsWith('holiday-')) {
                    console.log('Rendering holiday event:', event.title);
                    element.css({
                        'background-color': '#ffcdd2 !important',
                        'border-color': '#c62828 !important',
                        'color': '#b71c1c !important'
                    });
                }
                return element;
            }
        });
        
        this.calendarInitialized = true;
        console.log('Calendar initialization complete');
        // REMOVE THIS LINE - this is causing the conflict
        // this.loadCalendarEvents();
    }

    // Convert leave requests to calendar events
    getCalendarEvents() {
        let events = [];

    console.log('=== Getting Calendar Events ===');
    console.log('Requests available:', this.requests ? this.requests.length : 0);
    console.log('Holidays available:', this.holidays ? this.holidays.length : 0);

    if (this.requests && this.requests.length > 0) {
        const requestEvents = this.requests.map(request => {
            let color = this.getColorForType(request.Type__c);
            let backgroundColor = color;
            let borderColor = color;
            
            switch(request.Status__c) {
                case 'Approved':
                    break;
                case 'Rejected':
                    borderColor = '#ff0000ff';
                    backgroundColor = color + '80';
                    break;
                case 'Pending':
                    break;
            }

            const event = {
                id: request.Id,
                title: `${request.Type__c || 'Leave'} - ${request.Status__c}`,
                start: request.Start_Date__c,
                end: this.addDaysToDate(request.End_Date__c, 1),
                color: backgroundColor,
                borderColor: borderColor,
                allDay: true,
                requestData: request,
                className: `status-${request.Status__c?.toLowerCase() || 'unknown'}`
            };
            console.log('Created request event:', event.title, 'from', event.start, 'to', event.end);
            return event;
        });
        events = events.concat(requestEvents);
        console.log('Added request events:', requestEvents.length);
    }

    // REMOVED: Holiday events - we only want the labels, not the events
    // The holidays are still used for:
    // 1. Day styling in dayRender
    // 2. Date selection blocking in selectAllow
    // 3. Date picker disabling
    
    console.log('Total calendar events (requests only):', events.length);
    console.log('Final events array:', events.map(e => ({ id: e.id, title: e.title, start: e.start })));
    return events;
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
        // This method is no longer needed since we use the events function
        console.log('loadCalendarEvents called - but using events function instead');
        // Don't add any events here - the events function handles it
    }

    // Refresh calendar events when requests change
    refreshCalendarEvents() {
        if (!this.calendarInitialized) return;

        const calendarElement = this.template.querySelector('div.fullcalendarjs');
        if (calendarElement && $(calendarElement).fullCalendar) {
            console.log('Refreshing calendar events...');
            
            // Use refetchEvents to reload all events using the events function
            $(calendarElement).fullCalendar('refetchEvents');
            
            console.log('Events refreshed');
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
        // Validate required fields first
        if (!this.validateRequiredFields()) return;
        
        // Validate dates
        if (!this.validateDates()) return;

        // Check balance
        await this.updateDeltaSolde();
        if (!this.isBalanceSufficient) {
            this.showToast('Error', `Insufficient leave balance. Required: ${this.deltaSolde} days, Available: ${this.userBalance} days`, 'error');
            return;
        }

        this.isLoading = true;

        // Rest of your submission logic...
        const leaveRequest = {
            sobjectType: 'Leave_Request__c',
            Start_Date__c: this.startDate,
            End_Date__c: this.endDate,
            Reason__c: this.reason,
            Type__c: this.type,
            Business_Days__c: this.deltaSolde
        };

        if (this.isEditMode && this.editingRequestId) {
            leaveRequest.Id = this.editingRequestId;
        }

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

    // Add new validation method for required fields
validateRequiredFields() {
    const requiredFields = [];

    if (!this.startDate) {
        requiredFields.push('Start Date');
    }

    if (!this.endDate) {
        requiredFields.push('End Date');
    }

    if (!this.type) {
        requiredFields.push('Leave Type');
    }

    if (requiredFields.length > 0) {
        this.showToast('Error', `Please fill in the following required field(s): ${requiredFields.join(', ')}`, 'error');
        return false;
    }

    return true;
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