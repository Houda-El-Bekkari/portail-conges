import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

import getRequests from '@salesforce/apex/Leave_Request_Controller.getRequests';
import approveRequestByRH from '@salesforce/apex/Leave_Request_Controller.approveRequestByRH';
import rejectRequestByRH from '@salesforce/apex/Leave_Request_Controller.rejectRequestByRH';

export default class RhComponent extends LightningElement {
    @track requestsData = [];
    @track wiredRequestsResult;
    @track selectedRequestForApproval = null;
    @track approvalComments = '';
    @track isRefreshing = false;

    // Wire service pour récupérer toutes les demandes
    @wire(getRequests) 
    wiredRequests(result) {
        this.wiredRequestsResult = result;
        if (result.data) {
            console.log('Loaded all requests for RH:', result.data);
            this.requestsData = result.data.map(request => ({
                ...request,
                employeeName: request.CreatedBy && request.CreatedBy.Name ? request.CreatedBy.Name : 'Employé Inconnu'
            }));
        } else if (result.error) {
            console.error('Error loading requests for RH:', result.error);
            this.requestsData = [];
        }
    }

    // Getter pour les demandes approuvées par le manager (en attente d'approbation RH)
    get managerApprovedRequests() {
        return this.requestsData.filter(req => req.Status__c === 'ManagerApproved');
    }

    // Gestionnaires d'événements pour les clics sur les demandes
    handleRequestClick(event) {
        event.stopPropagation();
        const requestId = event.currentTarget.dataset.id;
        const request = this.requestsData.find(req => req.Id === requestId);
        
        if (request) {
            this.selectedRequestForApproval = request;
            this.approvalComments = '';
        }
    }

    handleQuickApproveRH(event) {
        event.stopPropagation();
        const requestId = event.target.dataset.id;
        this.performApprovalRH(requestId, '');
    }

    handleQuickRejectRH(event) {
        event.stopPropagation();
        const requestId = event.target.dataset.id;
        this.performRejectionRH(requestId, '');
    }

    // Gestionnaires de modal
    closeApprovalModal() {
        this.selectedRequestForApproval = null;
        this.approvalComments = '';
    }

    handleCommentsChange(event) {
        this.approvalComments = event.target.value;
    }

    confirmApprovalRH() {
        const requestId = this.selectedRequestForApproval.Id;
        this.performApprovalRH(requestId, this.approvalComments);
        this.closeApprovalModal();
    }

    confirmRejectionRH() {
        const requestId = this.selectedRequestForApproval.Id;
        this.performRejectionRH(requestId, this.approvalComments);
        this.closeApprovalModal();
    }

    // Logique d'approbation/rejet par RH
    performApprovalRH(requestId, comments) {
        if (!requestId) {
            this.showToast('Erreur', 'ID de demande non trouvé', 'error');
            return;
        }

        approveRequestByRH({ requestId, comments })
            .then(() => {
                this.showToast('Succès', 'Demande approuvée par RH avec succès', 'success');
                return refreshApex(this.wiredRequestsResult);
            })
            .catch(error => {
                console.error('Error approving request by RH:', error);
                this.showToast('Erreur', error.body?.message || 'Erreur lors de l\'approbation par RH', 'error');
            });
    }

    performRejectionRH(requestId, comments) {
        if (!requestId) {
            this.showToast('Erreur', 'ID de demande non trouvé', 'error');
            return;
        }

        rejectRequestByRH({ requestId, comments })
            .then(() => {
                this.showToast('Succès', 'Demande rejetée par RH avec succès', 'success');
                return refreshApex(this.wiredRequestsResult);
            })
            .catch(error => {
                console.error('Error rejecting request by RH:', error);
                this.showToast('Erreur', error.body?.message || 'Erreur lors du rejet par RH', 'error');
            });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // Getters pour l'historique des demandes traitées par RH
    get rhApprovedRequests() {
        return this.requestsData.filter(req => req.Status__c === 'Approved');
    }

    get rhRejectedRequests() {
        return this.requestsData.filter(req => req.Status__c === 'Rejected');
    }

    async handleRefresh() {
        if (this.isRefreshing) return;
        
        this.isRefreshing = true;
        try {
            await refreshApex(this.wiredRequestsResult);
            
        } catch (error) {
            console.error('Erreur de rafraîchissement:', error);
            this.showToast('Erreur', 'Échec du rafraîchissement des données', 'error');
        }
        this.isRefreshing = false;
    }
}