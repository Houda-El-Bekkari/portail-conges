import { LightningElement, track, wire } from 'lwc';
import FullCalendarJS from '@salesforce/resourceUrl/fullcalendarv3';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

import getHolidays_MA from '@salesforce/apex/HolidayService.getHolidays_MA';
import getRequests from '@salesforce/apex/Leave_Request_Controller.getRequests';
import approveRequest from '@salesforce/apex/Leave_Request_Controller.approveRequest';
import rejectRequest from '@salesforce/apex/Leave_Request_Controller.rejectRequest';

export default class ManagerComponent extends LightningElement {
    // Component state
    jsInitialised = false;
    @track disabledDates = [];
    @track holidayLabels = {};
    @track requestsData = [];
    @track wiredRequestsResult;

    // Modal and approval functionality
    @track selectedRequestForApproval = null;
    @track approvalComments = '';

    // Method to fetch holidays from the API
    async fetchHolidays() {
        try {
            const data = await getHolidays_MA();
            console.log('Fetched holidays:', data);

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

    // ========== WIRE SERVICES & GETTERS ==========
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
            
            if (this.jsInitialised) {
                this.refreshCalendarEvents();
            }
        } else if (result.error) {
            console.error('Error loading all requests:', result.error);
            this.requestsData = [];
        }
    }

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

        console.log('Starting to load calendar resources...');

        Promise.all([
            loadScript(this, FullCalendarJS + '/FullCalenderV3/jquery.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/moment.min.js'),
            loadScript(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.js'),
            loadStyle(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.css')
        ])
        .then(async () => {
            console.log('All resources loaded successfully');
            await this.fetchHolidays();
            this.initializeCalendar();
        })
        .catch(error => {
            console.error('Failed to load calendar resources:', error);
            this.showToast('Error', 'Failed to load calendar: ' + error.message, 'error');
        });
    }

    // ========== CALENDAR INITIALIZATION ==========
    initializeCalendar() { 
        try {
            const calendarElement = this.template.querySelector('div.fullcalendarjs');
            if (!calendarElement) {
                console.error('Calendar element not found in template');
                this.showToast('Error', 'Calendar container not found', 'error');
                return;
            }

            console.log('Initializing calendar...');
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
                events: [],
                weekNumbers: true,
                selectable: false, // Disable date selection since no form
                
                // Style weekends and holidays
                dayRender: function(date, cell) {
                    const dateStr = date.format('YYYY-MM-DD');
                    const isWeekend = (date.day() === 0 || date.day() === 6);
                    const isHoliday = self.disabledDates.includes(dateStr);

                    if (isWeekend || isHoliday) {
                        cell.css({
                            'background-color': '#f3f3f3',
                            'color': '#666'
                        });
                        cell.addClass(isWeekend ? 'weekend-cell' : 'disabled-date');

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
                
                // Handle event clicks for approval/rejection
                eventClick: function (calEvent, jsEvent, view) {
                    self.handleCalendarEventClick(calEvent);
                }
            });
            
            console.log('Calendar initialized successfully');
            this.loadCalendarEvents();
            
        } catch (error) {
            console.error('Error initializing calendar:', error);
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
        if (!this.requests || this.requests.length === 0) return [];
        
        return this.requests.map(request => {
            let color = this.getColorForType(request.Type__c);
            let backgroundColor = color;
            let borderColor = color;
            
            switch(request.Status__c) {
                case 'Approved':
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

            return {
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
        });
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

    // Load initial calendar events
    loadCalendarEvents() {
        try {
            const calendarElement = this.template.querySelector('div.fullcalendarjs');
            if (calendarElement && $(calendarElement).fullCalendar) {
                const events = this.getCalendarEvents();
                console.log('Loading calendar events:', events);
                $(calendarElement).fullCalendar('addEventSource', events);
            }
        } catch (error) {
            console.error('Error loading calendar events:', error);
        }
    }

    // Refresh calendar events when requests change
    refreshCalendarEvents() {
        try {
            const calendarElement = this.template.querySelector('div.fullcalendarjs');
            if (calendarElement && $(calendarElement).fullCalendar) {
                $(calendarElement).fullCalendar('removeEvents');
                const events = this.getCalendarEvents();
                if (events && events.length > 0) {
                    $(calendarElement).fullCalendar('addEventSource', events);
                }
            }
        } catch (error) {
            console.error('Error refreshing calendar events:', error);
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}