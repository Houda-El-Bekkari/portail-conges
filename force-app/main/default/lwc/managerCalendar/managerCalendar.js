import { LightningElement, track, wire } from 'lwc';
import getAllRequests from '@salesforce/apex/Leave_Request_Controller.getAllRequests';
import approveRequest from '@salesforce/apex/Leave_Request_Controller.approveRequest';
import rejectRequest from '@salesforce/apex/Leave_Request_Controller.rejectRequest';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ManagerCalendar extends LightningElement {
    @track requests = [];

    @wire(getAllRequests)
    wiredRequests({ data, error }) {
        if (data) {
            this.requests = data.map(r => ({
                ...r,
                isPending: r.Status__c === 'Pending'
            }));
        } else if (error) {
            this.showToast('Erreur', 'Impossible de charger les demandes', 'error');
        }
    }

    handleApprove(event) {
        const id = event?.target?.dataset?.id;
        if (!id) {
            this.showToast('Erreur', 'ID de demande non trouvé.', 'error');
            return;
        }
        approveRequest({ requestId: id })
            .then(() => {
                this.showToast('Succès', 'Demande approuvée.', 'success');
                return refreshApex(this.wiredRequests);
            })
            .catch(error => {
                this.showToast('Erreur', error?.body?.message || 'Erreur inconnue', 'error');
            });
    }

    handleReject(event) {
        const id = event.target.dataset.id;
        rejectRequest({ requestId: id })
            .then(() => {
                this.showToast('Succès', 'Demande rejetée.', 'success');
                return refreshApex(this.wiredRequests);
            })
            .catch(error => {
                this.showToast('Erreur', error.body.message, 'error');
            });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}