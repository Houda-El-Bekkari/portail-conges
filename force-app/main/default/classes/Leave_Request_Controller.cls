public with sharing class Leave_Request_Controller {
    
    public Leave_Request_Controller() {
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getRequests() {
        return [SELECT Id, Name, Start_Date__c, End_Date__c, Status__c, Reason__c, Type__c FROM Leave_Request__c ORDER BY CreatedDate DESC]; 
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
}