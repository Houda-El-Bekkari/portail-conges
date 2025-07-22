public with sharing class HistoriqueDemandesController {
    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getMyLeaveRequests() {
        return [
            SELECT Id, Type__c, Start_Date__c, End_Date__c, Status__c
            FROM Leave_Request__c
            WHERE CreatedById = :UserInfo.getUserId()
            ORDER BY Start_Date__c DESC
        ];
    }
}
