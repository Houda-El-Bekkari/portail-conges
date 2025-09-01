public with sharing class Leave_Request_Controller {
    
    public Leave_Request_Controller() {
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getRequests() {
        return [SELECT Id, Start_Date__c, End_Date__c, Status__c, Reason__c, Type__c, 
                CreatedBy.Name, CreatedById, Business_Days__c, Manager_Comments__c
                FROM Leave_Request__c 
                ORDER BY CreatedDate DESC];
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getMyRequests() {
        return [SELECT Id, Start_Date__c, End_Date__c, Reason__c, Type__c, Status__c, CreatedBy.Name, Manager_Comments__c, Business_Days__c
                FROM Leave_Request__c 
                WHERE CreatedById = :UserInfo.getUserId()
                ORDER BY CreatedDate DESC];
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
    public static void approveRequest(Id requestId, String comments) {
        Leave_Request__c req = [
            SELECT Id, Start_Date__c, End_Date__c, Status__c, CreatedById, Business_Days__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];

        if (req.Status__c != 'Pending') {
            throw new AuraHandledException('Seules les demandes en attente peuvent être approuvées.');
        }

        // Utiliser l'objet UserData__c qui référence le demandeur
        UserData__c demandeurData = [SELECT Id, Solde__c FROM UserData__c WHERE User__c = :req.CreatedById LIMIT 1];

        if (demandeurData.Solde__c < req.Business_Days__c) {
            throw new AuraHandledException('Le solde du demandeur est insuffisant.');
        }

        req.Status__c = 'ManagerApproved';
        req.Manager_Comments__c = comments;
        update req;
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getAllRequests() {
        return [SELECT Id, Start_Date__c, End_Date__c, Status__c, Reason__c, Type__c, CreatedBy.Name 
                FROM Leave_Request__c 
                ORDER BY CreatedDate DESC];
    }

    @AuraEnabled
    public static void rejectRequest(Id requestId, String comments) {
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
        req.Manager_Comments__c = comments;
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

    @AuraEnabled
    public static Decimal getDeltaSolde(Date startDate, Date endDate) {
        try {
            // Get Holiday__c records instead of Map<String, String>
            List<Holiday__c> holidays = [SELECT Date__c FROM Holiday__c WHERE Date__c >= :startDate AND Date__c <= :endDate];
            Set<Date> holidayDates = new Set<Date>();
            
            // Extract dates from Holiday__c records
            for (Holiday__c holiday : holidays) {
                if (holiday.Date__c != null) {
                    holidayDates.add(holiday.Date__c);
                }
            }

            Integer deltaSolde = 0;
            Date currentDate = startDate;
            while (currentDate <= endDate) {
                Integer dayOfWeek = Integer.valueOf(((Datetime) currentDate).format('u')); // 5=Saturday, 6=Sunday
                if (dayOfWeek != 5 && dayOfWeek != 6 && !holidayDates.contains(currentDate)) {
                    deltaSolde++;
                }
                currentDate = currentDate.addDays(1);
            }
            return deltaSolde;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }


    @AuraEnabled
    public static void approveRequestByRH(Id requestId, String comments) {
        Leave_Request__c req = [
            SELECT Id, Status__c, Manager_Comments__c, CreatedById, Business_Days__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];

        if (req.Status__c != 'ManagerApproved') {
            throw new AuraHandledException('Seules les demandes approuvées par le manager peuvent être approuvées par les RH.');
        }

        UserData__c user = [SELECT Id, Solde__c FROM UserData__c WHERE User__c = :req.CreatedById LIMIT 1];

        if (user.Solde__c < req.Business_Days__c) {
            throw new AuraHandledException('Le solde du demandeur est insuffisant.');
        }

        req.Status__c = 'Approved';
        req.Manager_Comments__c = comments; // Assuming Manager_Comments__c can store RH comments as well, or create a new field
        update req;

        user.Solde__c -= req.Business_Days__c;
        update user;
    }

    @AuraEnabled
    public static void rejectRequestByRH(Id requestId, String comments) {
        Leave_Request__c req = [
            SELECT Id, Status__c, Manager_Comments__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];

        if (req.Status__c != 'ManagerApproved') {
            throw new AuraHandledException('Seules les demandes approuvées par le manager peuvent être rejetées par les RH.');
        }

        req.Status__c = 'Rejected';
        req.Manager_Comments__c = comments; // Assuming Manager_Comments__c can store RH comments as well, or create a new field
        update req;
    }
}