public with sharing class Leave_Request_Controller {
    
    public Leave_Request_Controller() {
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getRequests() {
        return [SELECT Id, Start_Date__c, End_Date__c, Status__c, Reason__c, Type__c, 
                CreatedBy.Name, CreatedById
                FROM Leave_Request__c 
                ORDER BY CreatedDate DESC];
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
    return [SELECT Id, Start_Date__c, End_Date__c, Reason__c, Type__c, Status__c,CreatedBy.Name
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
    Leave_Request__c req = [
        SELECT Id, Start_Date__c, End_Date__c, Status__c, CreatedById
        FROM Leave_Request__c
        WHERE Id = :requestId
        LIMIT 1
    ];

    if (req.Status__c != 'Pending') {
        throw new AuraHandledException('Seules les demandes en attente peuvent être approuvées.');
    }

    Integer nbJours = req.Start_Date__c.daysBetween(req.End_Date__c) + 1;

    // Utiliser l'objet UserData__c qui référence le demandeur
    UserData__c demandeurData = [SELECT Id, Solde__c FROM UserData__c WHERE User__c = :req.CreatedById LIMIT 1];

    if (demandeurData.Solde__c < nbJours) {
        throw new AuraHandledException('Le solde du demandeur est insuffisant.');
    }

    demandeurData.Solde__c -= nbJours;
    update demandeurData;

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
    // Added: Method to get current user's balance
    @AuraEnabled(cacheable=true)
    public static Decimal getSolde() {
        try {
            // Make sure this matches where you're actually storing the balance
            UserData__c currentUser = [SELECT Id, Solde__c FROM UserData__c WHERE User__c = :UserInfo.getUserId() LIMIT 1];
            return currentUser.Solde__c != null ? currentUser.Solde__c : 0;
        } catch (Exception e) {
            System.debug('Error getting solde: ' + e.getMessage());
            return 0;
        }
    }
}