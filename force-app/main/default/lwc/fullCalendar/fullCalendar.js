import { LightningElement, api, track, wire } from 'lwc';
import FullCalendarJS from '@salesforce/resourceUrl/fullcalendarv3';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
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

export default class Calender extends LightningElement {
    jsInitialised = false;
    flatpickrInitialized = false;
    startDatePicker = null;
    endDatePicker = null;
    @track _events;
    @track startDate = '';
    @track endDate = '';
    @track reason = '';
    @track type = '';
    @track isLoading = false;
    @track editingRequestId = null;
    @track isEditMode = false;

    //----------------- get Types list -----------------
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
    //-------------------------

    get formTitle() {
        return this.isEditMode ? 'Edit Leave Request' : 'Leave Request Form';
    }

    get submitButtonLabel() {
        return this.isEditMode ? 'Update Request' : 'Submit Request';
    }

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
        try
        {
            this.events=eval(value);
        }
        catch{
           this.events=[];
        }
    }

  renderedCallback() {

    // Performs this operation only on first render
    if (this.jsInitialised) {
      return;
    }
    this.jsInitialised = true;

    Promise.all([
      loadScript(this, FullCalendarJS + '/FullCalenderV3/jquery.min.js'),
      loadScript(this, FullCalendarJS + '/FullCalenderV3/moment.min.js'),
      loadScript(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.js'),
      loadStyle(this, FullCalendarJS + '/FullCalenderV3/fullcalendar.min.css'),
      loadScript(this, flatpickrJs),
      loadStyle(this, flatpickrCss)
    ])
    .then(() => {
      this.initialiseCalendarJs();
      this.initializeFlatpickr();
    })
    .catch(error => {
        alert(error);
        new ShowToastEvent({
            title: 'Error!',
            message: error,
            variant: 'error'
        })
    })
  }

  initializeFlatpickr() {
    if (this.flatpickrInitialized) return;
    this.flatpickrInitialized = true;

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

    this.startDatePicker = flatpickr(startInput, {
        dateFormat: 'Y-m-d',
        onChange: (selectedDates, dateStr) => {
            this.startDate = dateStr;
        },
        disable: [disableWeekends, ...disableDates]
    });

    this.endDatePicker = flatpickr(endInput, {
        dateFormat: 'Y-m-d',
        onChange: (selectedDates, dateStr) => {
            this.endDate = dateStr;
        },
        disable: [disableWeekends, ...disableDates]
    });
  }

  initialiseCalendarJs() { 
    var that=this;
    const ele = this.template.querySelector('div.fullcalendarjs');
    //Use jQuery to instantiate fullcalender JS
    $(ele).fullCalendar({
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
      dragScroll:true,
      droppable:true,
      weekNumbers:true,
      selectable:true,
      selectConstraint: {
        dow: [1, 2, 3, 4, 5]
      },
      selectAllow: function(selectInfo) {
        var day = selectInfo.start.day();
        return day !== 0 && day !== 6;
      },
      select: function(start, end) {
        // Handle date range selection
        that.handleDateSelection(start, end);
      },
      //eventClick: this.eventClick,
      eventClick: function (info) {
        const selectedEvent = new CustomEvent('eventclicked', { detail: info.Id });
        that.dispatchEvent(selectedEvent);
        }
    });
  }

  handleDateSelection(start, end) {
    // Convert moment objects to date strings
    this.startDate = start.format('YYYY-MM-DD');
    this.endDate = end.subtract(1, 'day').format('YYYY-MM-DD'); // Subtract 1 day as FullCalendar end is exclusive
    
    // Update the flatpickr inputs to reflect the calendar selection
    if (this.startDatePicker) {
      this.startDatePicker.setDate(this.startDate, false); // false prevents triggering onChange
    }
    if (this.endDatePicker) {
      this.endDatePicker.setDate(this.endDate, false); // false prevents triggering onChange
    }
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