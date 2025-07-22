import { LightningElement, wire } from 'lwc';
import getMyLeaveRequests from '@salesforce/apex/HistoriqueDemandesController.getMyLeaveRequests';

export default class HistoriqueDemandes extends LightningElement {
    demandes;
    error;

    columns = [
        { label: 'Type', fieldName: 'Type__c' },
        { label: 'Start Date', fieldName: 'Start_Date__c', type: 'date' },
        { label: 'End Date', fieldName: 'End_Date__c', type: 'date' },
        { label: 'Status', fieldName: 'Status__c' },
    ];

    @wire(getMyLeaveRequests)
    wiredDemandes({ data, error }) {
        if (data) {
            this.demandes = data;
        } else if (error) {
            this.error = error;
        }
    }
}
