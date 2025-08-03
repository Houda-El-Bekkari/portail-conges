public with sharing class Leave_Request_Controller {
    
    public Leave_Request_Controller() {
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getRequests() {
        return [SELECT Id, Start_Date__c, End_Date__c, Status__c, Reason__c, Type__c, CreatedBy.Name FROM Leave_Request__c ORDER BY CreatedDate DESC]; 
    }

    @AuraEnabled(cacheable=true)
    public static Leave_Request__c getRequest(Id requestId) {
        if (requestId == null) {
            throw new AuraHandledException('Request ID cannot be null.');
        }
        
        Leave_Request__c request = [SELECT Id, Name, Start_Date__c, End_Date__c, Status__c, Reason__c, Type__c FROM Leave_Request__c WHERE Id = :requestId LIMIT 1];
        if (request == null) {
            throw new AuraHandledException('Leave request not found.');
        }
        
        return request;
    }
@AuraEnabled(cacheable=true)
public static List<Leave_Request__c> getMyRequests() {
    return [SELECT Id, Start_Date__c, End_Date__c, Reason__c, Type__c, Status__c 
            FROM Leave_Request__c 
            WHERE CreatedById = :UserInfo.getUserId()];
}

    @AuraEnabled
    public static Leave_Request__c createRequest(Leave_Request__c request) {
        insert request;
        return request;

    }

    @AuraEnabled
    public static Leave_Request__c updateRequest(Leave_Request__c request) {
        // Only allow updates to pending requests
        Leave_Request__c existingRequest = [SELECT Id, Status__c FROM Leave_Request__c WHERE Id = :request.Id LIMIT 1];
        if (existingRequest.Status__c != 'Pending') {
            throw new AuraHandledException('Only pending requests can be updated.');
        }
        
        update request;
        return request;
    }

    @AuraEnabled
    public static void deleteRequest(Id requestId) {
        delete [SELECT Id FROM Leave_Request__c WHERE Id = :requestId LIMIT 1];
    }

    @AuraEnabled
    public static void cancelRequest(Id requestId) {
        Leave_Request__c request = [SELECT Id, Status__c FROM Leave_Request__c WHERE Id = :requestId LIMIT 1];
        if (request.Status__c != 'Pending') {
            throw new AuraHandledException('Only pending requests can be cancelled.');
        }
        
        request.Status__c = 'Cancelled';
        update request;
    }
   @AuraEnabled
    public static void approveRequest(Id requestId) {
        List<Leave_Request__c> reqList = [
            SELECT Id, Start_Date__c, End_Date__c, Status__c, CreatedById
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];
        if (reqList.isEmpty()) {
            throw new AuraHandledException('La demande de congé n\'existe pas.');
        }
        Leave_Request__c req = reqList[0];

        if (req.Status__c != 'Pending') {
            throw new AuraHandledException('Seules les demandes en attente peuvent être approuvées.');
        }

        Integer nbJours = req.End_Date__c.daysBetween(req.Start_Date__c) + 1;

        // Utiliser le propriétaire de la demande
        List<User> demandeurList = [SELECT Id, Solde__c FROM User WHERE Id = :req.CreatedById LIMIT 1];
        if (demandeurList.isEmpty()) {
            throw new AuraHandledException('Le demandeur n\'existe pas.');
        }
        User demandeur = demandeurList[0];

        if (demandeur.Solde__c == null ) {
            throw new AuraHandledException('Le solde du demandeur est insuffisant.');
        }

        demandeur.Solde__c -= nbJours;
        update demandeur;

        req.Status__c = 'Approved';
        update req;
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getAllRequests() {
        return [SELECT Id, Start_Date__c, End_Date__c, Status__c, Reason__c, Type__c, CreatedBy.Name 
                FROM Leave_Request__c 
                ORDER BY CreatedDate DESC];
    }

    @AuraEnabled
    public static void rejectRequest(Id requestId) {
        Leave_Request__c req = [
            SELECT Id, Status__c 
            FROM Leave_Request__c 
            WHERE Id = :requestId 
            LIMIT 1
        ];

        if (req.Status__c != 'Pending') {
            throw new AuraHandledException('Seules les demandes en attente peuvent être rejetées.');
        }

        req.Status__c = 'Rejected';
        update req;
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getMySolde() {
        return [SELECT Id, Solde__c FROM User WHERE Id = :UserInfo.getUserId()];
    }

}