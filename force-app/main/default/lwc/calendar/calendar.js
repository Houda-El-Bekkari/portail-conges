import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import createRequest from '@salesforce/apex/Leave_Request_Controller.createRequest';
import updateRequest from '@salesforce/apex/Leave_Request_Controller.updateRequest';
import getRequests from '@salesforce/apex/Leave_Request_Controller.getRequests';
import deleteRequest from '@salesforce/apex/Leave_Request_Controller.deleteRequest';


export default class Calendar extends LightningElement {
    
}