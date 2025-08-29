import { LightningElement, track, wire } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

import FullCalendarJS from '@salesforce/resourceUrl/fullcalendarv3';

import getHolidays_MA from '@salesforce/apex/HolidayService.getHolidays_MA';
import getRequests from '@salesforce/apex/Leave_Request_Controller.getRequests';
import approveRequest from '@salesforce/apex/Leave_Request_Controller.approveRequest';
import rejectRequest from '@salesforce/apex/Leave_Request_Controller.rejectRequest';

export default class ManagerComponent extends LightningElement {
    // Component state
    jsInitialised = false;
    calendarInitialized = false;
    @track holidays = [];
    @track holidaysLoaded = false;
    @track requestsData = [];
    @track wiredRequestsResult;
    @track holidaysWire;

    // Modal and approval functionality
    @track selectedRequestForApproval = null;
    @track approvalComments = '';

    // ========== WIRE SERVICES ==========
    @wire(getHolidays_MA)
    wiredHolidays(result) {
        console.log('Manager - wiredHolidays called:', result);
        this.holidaysWire = result;
        if (result.data) {
            console.log('Manager - Holiday records received:', result.data);
            console.log('Manager - Holiday count:', result.data.length);
            console.log('Manager - Sample holiday structure:', JSON.stringify(result.data[0], null, 2));
            
            // Check each holiday's date format
            result.data.forEach((holiday, index) => {
                console.log(`Manager - Holiday ${index}:`, {
                    Id: holiday.Id,
                    Name: holiday.Name,
                    Date__c: holiday.Date__c,
                    dateType: typeof holiday.Date__c
                });
            });
            
            this.holidays = result.data;
            this.holidaysLoaded = true;
            
            if (this.jsInitialised && !this.calendarInitialized) {
                console.log('Manager - Both scripts and holidays loaded - initializing calendar');
                this.initializeCalendar();
            } else if (this.calendarInitialized) {
                console.log('Manager - Calendar already initialized, refreshing events');
                this.refreshCalendarEvents();
            }
        } else if (result.error) {
            console.error('Manager - Error loading holidays:', result.error);
            this.holidays = [];
            this.holidaysLoaded = true;
        }
    }

    @wire(getRequests) 
    wiredRequests(result) {
        this.wiredRequestsResult = result;
        if (result.data) {
            console.log('Loaded all requests:', result.data);
            this.requestsData = result.data.map(request => ({
                ...request,
                isPending: request.Status__c === 'Pending',
                isApproved: request.Status__c === 'Approved' || request.Status__c === 'ManagerApproved',
                isRejected: request.Status__c === 'Rejected',
                employeeName: request.CreatedBy && request.CreatedBy.Name ? request.CreatedBy.Name : 'Unknown Employee'
            }));
            
            if (this.calendarInitialized) {
                this.refreshCalendarEvents();
            }
        } else if (result.error) {
            console.error('Error loading all requests:', result.error);
            this.requestsData = [];
        }
    }

    // ========== REQUEST CLICK HANDLERS ==========
    handleRequestClick(event) {
        event.stopPropagation();
        const requestId = event.currentTarget.dataset.id;
        const request = this.requests.find(req => req.Id === requestId);
        
        if (request) {
            this.selectedRequestForApproval = request;
            this.approvalComments = '';
        }
    }

    handleQuickApprove(event) {
        event.stopPropagation();
        const requestId = event.target.dataset.id;
        this.performApproval(requestId, '');
    }

    handleQuickReject(event) {
        event.stopPropagation();
        const requestId = event.target.dataset.id;
        this.performRejection(requestId, '');
    }

    closeApprovalModal() {
        this.selectedRequestForApproval = null;
        this.approvalComments = '';
    }

    handleCommentsChange(event) {
        this.approvalComments = event.target.value;
    }

    confirmApproval() {
        const requestId = this.selectedRequestForApproval.Id;
        this.performApproval(requestId, this.approvalComments);
        this.closeApprovalModal();
    }

    confirmRejection() {
        const requestId = this.selectedRequestForApproval.Id;
        this.performRejection(requestId, this.approvalComments);
        this.closeApprovalModal();
    }

    // ========== APPROVAL/REJECTION LOGIC ==========
    performApproval(requestId, comments) {
        if (!requestId) {
            this.showToast('Error', 'Request ID not found', 'error');
            return;
        }

        approveRequest({ requestId, comments })
            .then(() => {
                this.showToast('Success', 'Request approved successfully', 'success');
                return refreshApex(this.wiredRequestsResult);
            })
            .catch(error => {
                console.error('Error approving request:', error);
                this.showToast('Error', error.body?.message || 'Error approving request', 'error');
            });
    }

    performRejection(requestId, comments) {
        if (!requestId) {
            this.showToast('Error', 'Request ID not found', 'error');
            return;
        }

        rejectRequest({ requestId, comments })
            .then(() => {
                this.showToast('Success', 'Request rejected successfully', 'success');
                return refreshApex(this.wiredRequestsResult);
            })
            .catch(error => {
                console.error('Error rejecting request:', error);
                this.showToast('Error', error.body?.message || 'Error rejecting request', 'error');
            });
    }

    // ========== GETTERS ==========
    get requests() {
        return this.requestsData;
    }

    get pendingRequests() {
        return this.requestsData.filter(req => req.Status__c === 'Pending');
    }

    get approvedRequests() {
        return this.requestsData.filter(req => req.Status__c === 'Approved' || req.Status__c === 'ManagerApproved');
    }

    get rejectedRequests() {
        return this.requestsData.filter(req => req.Status__c === 'Rejected');
    }

    // ========== COMPONENT LIFECYCLE ==========
    renderedCallback() {
        if (this.jsInitialised) return;
        this.jsInitialised = true;

        console.log('Manager - Loading scripts...');
        Promise.all([
            loadScript(this, FullCalendarJS + '/FullCalenderV3/jquery.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/moment.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.js'),
            loadStyle(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.css')
        ])
        .then(() => {
            console.log('Manager - Scripts loaded. Holidays loaded?', this.holidaysLoaded, 'Calendar initialized?', this.calendarInitialized);
            if (this.holidaysLoaded && !this.calendarInitialized) {
                console.log('Manager - Initializing calendar from renderedCallback');
                this.initializeCalendar();
            }
        })
        .catch(error => {
            console.error('Manager - Failed to load calendar resources:', error);
            this.showToast('Error', 'Failed to load calendar: ' + error.message, 'error');
        });
    }

    // ========== CALENDAR INITIALIZATION ==========
    initializeCalendar() { 
        if (this.calendarInitialized) {
            console.log('Manager - Calendar already initialized, skipping');
            return;
        }

        try {
            const calendarElement = this.template.querySelector('div.fullcalendarjs');
            if (!calendarElement) {
                console.error('Manager - Calendar element not found in template');
                this.showToast('Error', 'Calendar container not found', 'error');
                return;
            }

            console.log('Manager - Initializing calendar with holidays:', this.holidays.length);
            const self = this;

            $(calendarElement).fullCalendar({
                header: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'month,basicWeek,basicDay'
                },
                defaultDate: new Date(),
                navLinks: true, 
                editable: false,
                eventLimit: true,
                
                events: function(start, end, timezone, callback) {
                    console.log('Manager - Events function called for range:', start.format(), 'to', end.format());
                    const events = self.getCalendarEvents();
                    console.log('Manager - Returning events from events function:', events);
                    callback(events);
                },
                
                weekNumbers: true,
                selectable: false, // Disable date selection since no form
                
                // Style weekends and holidays using holidays array directly
                dayRender: function(date, cell) {
                    const dateStr = date.format('YYYY-MM-DD');
                    const isWeekend = (date.day() === 0 || date.day() === 6);
                    // Handle both Date__c and Date__c field names
                    const holidayRecord = self.holidays.find(holiday => {
                        const holidayDate = holiday.Date__c || holiday.Date__c;
                        return holidayDate === dateStr;
                    });
                    const isHoliday = !!holidayRecord;

                    if (isWeekend) {
                        cell.css({
                            'background-color': '#f3f3f3',
                            'color': '#666'
                        });
                        cell.addClass('weekend-cell');
                    }

                    if (isHoliday && holidayRecord) {
                        console.log(`Manager - Applying holiday styling to ${dateStr} for:`, holidayRecord.Name);
                        cell.css({
                            'background-color': '#ffebee',
                            'color': '#c62828',
                            'font-weight': 'bold'
                        });
                        cell.addClass('holiday-cell');

                        // Add holiday label
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
                
                // Handle event clicks for approval/rejection
                eventClick: function (calEvent, jsEvent, view) {
                    self.handleCalendarEventClick(calEvent);
                },

                eventRender: function(event, element) {
                    console.log('Manager - eventRender called for:', event.title, 'ID:', event.id);
                    return element;
                }
            });
            
            this.calendarInitialized = true;
            console.log('Manager - Calendar initialization complete');
            
        } catch (error) {
            console.error('Manager - Error initializing calendar:', error);
            this.showToast('Error', 'Failed to initialize calendar: ' + error.message, 'error');
        }
    }

    // Enhanced: Better calendar event click handling for managers
    handleCalendarEventClick(calEvent) {
        const request = calEvent.requestData;
        if (request) {
            this.selectedRequestForApproval = request;
            this.approvalComments = '';
        }
    }

    // Convert leave requests to calendar events
    getCalendarEvents() {
        if (!this.requests || this.requests.length === 0) {
            console.log('Manager - No requests available for calendar events');
            return [];
        }
        
        console.log('Manager - Processing requests for calendar events:', this.requests.length);
        
        const events = this.requests.map(request => {
            let color = this.getColorForType(request.Type__c);
            let backgroundColor = color;
            let borderColor = color;
            
            switch(request.Status__c) {
                case 'Approved':
                case 'ManagerApproved':
                    break;
                case 'Rejected':
                    borderColor = '#000000';
                    backgroundColor = color + '80';
                    break;
                case 'Pending':
                    borderColor = '#ffc107';
                    backgroundColor = color + 'CC';
                    break;
            }

            const event = {
                id: request.Id,
                title: `${request.employeeName} - ${request.Type__c || 'Leave'} (${request.Status__c})`,
                start: request.Start_Date__c,
                end: this.addDaysToDate(request.End_Date__c, 1),
                color: backgroundColor,
                borderColor: borderColor,
                allDay: true,
                requestData: request,
                className: `status-${request.Status__c?.toLowerCase() || 'unknown'} clickable-request`,
                textColor: '#000000'
            };
            
            console.log('Manager - Created request event:', event.title, 'from', event.start, 'to', event.end);
            return event;
        });

        console.log('Manager - Total calendar events:', events.length);
        return events;
    }

    // Get color based on leave type
    getColorForType(type) {
        const typeColors = {
            'Sick Leave': '#dc3545',
            'Training Leave': '#28a745',
            'Vacation': '#17a2b8',
        };
        return typeColors[type] || '#6c757d';
    }

    // Helper method to add days to a date string
    addDaysToDate(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    // Refresh calendar events when requests change
    refreshCalendarEvents() {
        if (!this.calendarInitialized) return;

        const calendarElement = this.template.querySelector('div.fullcalendarjs');
        if (calendarElement && $(calendarElement).fullCalendar) {
            console.log('Manager - Refreshing calendar events...');
            
            // Use refetchEvents to reload all events using the events function
            $(calendarElement).fullCalendar('refetchEvents');
            
            console.log('Manager - Events refreshed');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}