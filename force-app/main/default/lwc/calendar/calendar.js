import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getRequests from '@salesforce/apex/Leave_Request_Controller.getRequests';

export default class Calendar extends LightningElement {
    @track currentDate = new Date();
    @track calendarData = [];
    
    @wire(getRequests) 
    wiredRequests({ error, data }) {
        if (data) {
            this.leaveRequests = data;
            this.generateCalendar();
        } else if (error) {
            this.showToast('Error', 'Error loading leave requests', 'error');
        }
    }

    get monthYear() {
        const options = { year: 'numeric', month: 'long' };
        return this.currentDate.toLocaleDateString(undefined, options);
    }

    get weekDays() {
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }

    connectedCallback() {
        this.generateCalendar();
    }

    generateCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Get first day of the month and number of days in month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Get days from previous month to fill the first week
        const prevMonth = new Date(year, month, 0);
        const daysInPrevMonth = prevMonth.getDate();
        
        const calendarDays = [];
        let dayCount = 1;
        let nextMonthDayCount = 1;
        
        // Generate 6 weeks (42 days) for the calendar
        for (let week = 0; week < 6; week++) {
            const weekDays = [];
            
            for (let day = 0; day < 7; day++) {
                const dayIndex = week * 7 + day;
                let dayData = {};
                
                if (dayIndex < startingDayOfWeek) {
                    // Previous month days
                    const dayNum = daysInPrevMonth - startingDayOfWeek + dayIndex + 1;
                    dayData = {
                        day: dayNum,
                        isCurrentMonth: false,
                        isToday: false,
                        date: new Date(year, month - 1, dayNum),
                        hasLeave: false,
                        leaveRequests: [],
                        cssClass: 'calendar-day other-month',
                        dayDataJson: JSON.stringify({
                            day: dayNum,
                            hasLeave: false,
                            leaveRequests: [],
                            date: new Date(year, month - 1, dayNum).toISOString()
                        })
                    };
                } else if (dayCount <= daysInMonth) {
                    // Current month days
                    const currentDay = new Date(year, month, dayCount);
                    const isToday = this.isToday(currentDay);
                    const leaveInfo = this.getLeaveRequestsForDate(currentDay);
                    
                    dayData = {
                        day: dayCount,
                        isCurrentMonth: true,
                        isToday: isToday,
                        date: currentDay,
                        hasLeave: leaveInfo.hasLeave,
                        leaveRequests: leaveInfo.requests,
                        cssClass: this.getDayCssClass(isToday, leaveInfo.hasLeave),
                        dayDataJson: JSON.stringify({
                            day: dayCount,
                            hasLeave: leaveInfo.hasLeave,
                            leaveRequests: leaveInfo.requests,
                            date: currentDay.toISOString()
                        })
                    };
                    dayCount++;
                } else {
                    // Next month days
                    dayData = {
                        day: nextMonthDayCount,
                        isCurrentMonth: false,
                        isToday: false,
                        date: new Date(year, month + 1, nextMonthDayCount),
                        hasLeave: false,
                        leaveRequests: [],
                        cssClass: 'calendar-day other-month',
                        dayDataJson: JSON.stringify({
                            day: nextMonthDayCount,
                            hasLeave: false,
                            leaveRequests: [],
                            date: new Date(year, month + 1, nextMonthDayCount).toISOString()
                        })
                    };
                    nextMonthDayCount++;
                }
                
                weekDays.push(dayData);
            }
            
            calendarDays.push(weekDays);
        }
        
        this.calendarData = calendarDays;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getLeaveRequestsForDate(date) {
        if (!this.leaveRequests) {
            return { hasLeave: false, requests: [] };
        }
        
        const requests = this.leaveRequests.filter(request => {
            const startDate = new Date(request.Start_Date__c);
            const endDate = new Date(request.End_Date__c);
            return date >= startDate && date <= endDate;
        });
        
        return {
            hasLeave: requests.length > 0,
            requests: requests
        };
    }

    getDayCssClass(isToday, hasLeave) {
        let cssClass = 'calendar-day current-month';
        if (isToday) {
            cssClass += ' today';
        }
        if (hasLeave) {
            cssClass += ' has-leave';
        }
        return cssClass;
    }

    handlePreviousMonth() {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
        this.generateCalendar();
    }

    handleNextMonth() {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
        this.generateCalendar();
    }

    handleToday() {
        this.currentDate = new Date();
        this.generateCalendar();
    }

    handleDayClick(event) {
        const dayElement = event.currentTarget;
        const dayDataString = dayElement.dataset.dayData;
        
        try {
            const dayData = JSON.parse(dayDataString);
            
            if (dayData.hasLeave) {
                this.showLeaveDetails(dayData);
            }
        } catch (error) {
            console.error('Error parsing day data:', error);
        }
    }

    showLeaveDetails(dayData) {
        const requests = dayData.leaveRequests;
        let message = `Leave requests for ${dayData.date.toLocaleDateString()}:\n\n`;
        
        requests.forEach(request => {
            message += `• ${request.Start_Date__c} to ${request.End_Date__c}\n`;
            message += `  Status: ${request.Status__c}\n`;
            if (request.Type__c) {
                message += `  Type: ${request.Type__c}\n`;
            }
            if (request.Reason__c) {
                message += `  Reason: ${request.Reason__c}\n`;
            }
            message += '\n';
        });
        
        this.showToast('Leave Details', message, 'info');
    }

    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
    }
}