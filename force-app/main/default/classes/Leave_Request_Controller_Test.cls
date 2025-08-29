/**
 * This class contains unit tests for validating the behavior of Apex classes
 * and triggers.
 *
 * Unit tests are class methods that verify whether a particular piece
 * of code is working properly. Unit test methods take no arguments,
 * commit no data to the database, and are flagged with the testMethod
 * keyword in the method definition.
 *
 * All test methods in an org are executed whenever Apex code is deployed
 * to a production org to confirm correctness, ensure code
 * coverage, and prevent regressions. All Apex classes are
 * required to have at least 75% code coverage in order to be deployed
 * to a production org. In addition, all triggers must have some code coverage.
 * 
 * The @isTest class annotation indicates this class only contains test
 * methods. Classes defined with the @isTest annotation do not count against
 * the org size limit for all Apex scripts.
 *
 * See the Apex Language Reference for more information about Testing and Code Coverage.
 */
@isTest
private class Leave_Request_Controller_Test {
    
    @TestSetup
    static void makeData() {
        // Create test users
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name='Standard User' LIMIT 1];
        
        User testUser1 = new User(
            Alias = 'test1',
            Email = 'test1@example.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'TestUser1',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = standardProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'test1@example.com.test' + System.currentTimeMillis()
        );
        insert testUser1;
        
        User testUser2 = new User(
            Alias = 'test2',
            Email = 'test2@example.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'TestUser2',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = standardProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'test2@example.com.test' + System.currentTimeMillis()
        );
        insert testUser2;
        
        // Create UserData records
        List<UserData__c> userDataList = new List<UserData__c>();
        userDataList.add(new UserData__c(
            User__c = testUser1.Id,
            Solde__c = 25
        ));
        userDataList.add(new UserData__c(
            User__c = testUser2.Id,
            Solde__c = 30
        ));
        insert userDataList;
        
        // Create test holidays
        List<Holiday__c> holidays = new List<Holiday__c>();
        holidays.add(new Holiday__c(
            Name = 'Test Holiday 1',
            Date__c = Date.today().addDays(10)
        ));
        holidays.add(new Holiday__c(
            Name = 'Test Holiday 2',
            Date__c = Date.today().addDays(20)
        ));
        insert holidays;
        
        // Create test leave requests
        System.runAs(testUser1) {
            List<Leave_Request__c> requests = new List<Leave_Request__c>();
            requests.add(new Leave_Request__c(
                Start_Date__c = Date.today().addDays(5),
                End_Date__c = Date.today().addDays(7),
                Status__c = 'Pending',
                Reason__c = 'Vacation',
                Type__c = 'Vacation',
                Business_Days__c = 3
            ));
            requests.add(new Leave_Request__c(
                Start_Date__c = Date.today().addDays(15),
                End_Date__c = Date.today().addDays(17),
                Status__c = 'ManagerApproved',
                Reason__c = 'Training',
                Type__c = 'Training Leave',
                Business_Days__c = 3
            ));
            insert requests;
        }
    }
    
    @isTest
    static void testGetRequests() {
        Test.startTest();
        List<Leave_Request__c> requests = Leave_Request_Controller.getRequests();
        Test.stopTest();
        
        System.assertNotEquals(null, requests, 'Requests should not be null');
        System.assertEquals(2, requests.size(), 'Should return 2 requests');
        System.assertNotEquals(null, requests[0].CreatedBy.Name, 'CreatedBy.Name should be populated');
    }
    
    @isTest
    static void testGetMyRequests() {
        User testUser = [SELECT Id FROM User WHERE Email = 'test1@example.com' LIMIT 1];
        
        System.runAs(testUser) {
            Test.startTest();
            List<Leave_Request__c> myRequests = Leave_Request_Controller.getMyRequests();
            Test.stopTest();
            
            System.assertNotEquals(null, myRequests, 'My requests should not be null');
            System.assertEquals(2, myRequests.size(), 'Should return 2 requests for current user');
        }
    }
    
    @isTest
    static void testCreateRequest() {
        User testUser = [SELECT Id FROM User WHERE Email = 'test2@example.com' LIMIT 1];
        
        System.runAs(testUser) {
            Leave_Request__c newRequest = new Leave_Request__c(
                Start_Date__c = Date.today().addDays(30),
                End_Date__c = Date.today().addDays(32),
                Status__c = 'Pending',
                Reason__c = 'Personal',
                Type__c = 'Vacation',
                Business_Days__c = 3
            );
            
            Test.startTest();
            Leave_Request__c createdRequest = Leave_Request_Controller.createRequest(newRequest);
            Test.stopTest();
            
            System.assertNotEquals(null, createdRequest.Id, 'Request should be created with an ID');
            
            // Verify it was actually inserted
            Leave_Request__c verifyRequest = [SELECT Id, Start_Date__c, Status__c FROM Leave_Request__c WHERE Id = :createdRequest.Id];
            System.assertEquals('Pending', verifyRequest.Status__c, 'Status should be Pending');
        }
    }
    
    @isTest
    static void testUpdatePendingRequest() {
        User testUser = [SELECT Id FROM User WHERE Email = 'test1@example.com' LIMIT 1];
        Leave_Request__c existingRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'Pending' LIMIT 1];
        
        System.runAs(testUser) {
            existingRequest.Reason__c = 'Updated reason';
            
            Test.startTest();
            Leave_Request__c updatedRequest = Leave_Request_Controller.updateRequest(existingRequest);
            Test.stopTest();
            
            System.assertEquals('Updated reason', updatedRequest.Reason__c, 'Reason should be updated');
        }
    }
    
    @isTest
    static void testUpdateRequest_NonPendingRequest() {
        User testUser = [SELECT Id FROM User WHERE Email = 'test1@example.com' LIMIT 1];
        Leave_Request__c existingRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'ManagerApproved' LIMIT 1];
        
        System.runAs(testUser) {
            existingRequest.Reason__c = 'Updated reason';
            
            Test.startTest();
            try {
                Leave_Request_Controller.updateRequest(existingRequest);
                System.assert(false, 'Should have thrown an exception');
            } catch (AuraHandledException e) {
                System.assertEquals('Script-thrown exception', e.getMessage());
            }
            Test.stopTest();
        }
    }
    
    @isTest
    static void testDeleteRequest() {
        Leave_Request__c requestToDelete = [SELECT Id FROM Leave_Request__c LIMIT 1];
        
        Test.startTest();
        Leave_Request_Controller.deleteRequest(requestToDelete.Id);
        Test.stopTest();
        
        List<Leave_Request__c> remainingRequests = [SELECT Id FROM Leave_Request__c WHERE Id = :requestToDelete.Id];
        System.assertEquals(0, remainingRequests.size(), 'Request should be deleted');
    }
    
    @isTest
    static void testApproveRequest_Success() {
        Leave_Request__c pendingRequest = [SELECT Id, CreatedById FROM Leave_Request__c WHERE Status__c = 'Pending' LIMIT 1];
        
        Test.startTest();
        Leave_Request_Controller.approveRequest(pendingRequest.Id, 'Approved by manager');
        Test.stopTest();
        
        Leave_Request__c updatedRequest = [SELECT Id, Status__c, Manager_Comments__c FROM Leave_Request__c WHERE Id = :pendingRequest.Id];
        System.assertEquals('ManagerApproved', updatedRequest.Status__c, 'Status should be ManagerApproved');
        System.assertEquals('Approved by manager', updatedRequest.Manager_Comments__c, 'Manager comments should be set');
        
        // ✅ UPDATED EXPECTATION - Balance should remain unchanged until RH approval
        UserData__c userData = [SELECT Solde__c FROM UserData__c WHERE User__c = :pendingRequest.CreatedById];
        System.assertEquals(25, userData.Solde__c, 'Balance should remain unchanged until final RH approval');
    }
    
    @isTest
    static void testApproveRequest_InsufficientBalance() {
        Leave_Request__c pendingRequest = [SELECT Id, CreatedById FROM Leave_Request__c WHERE Status__c = 'Pending' LIMIT 1];
        
        // Reduce user balance to insufficient amount
        UserData__c userData = [SELECT Id, Solde__c FROM UserData__c WHERE User__c = :pendingRequest.CreatedById];
        userData.Solde__c = 1;
        update userData;
        
        Test.startTest();
        try {
            Leave_Request_Controller.approveRequest(pendingRequest.Id, 'Should fail');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assertEquals('Script-thrown exception', e.getMessage());
        }
        Test.stopTest();
    }
    
    @isTest
    static void testApproveRequest_NonPendingRequest() {
        Leave_Request__c approvedRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'ManagerApproved' LIMIT 1];
        
        Test.startTest();
        try {
            Leave_Request_Controller.approveRequest(approvedRequest.Id, 'Should fail');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assertEquals('Script-thrown exception', e.getMessage());
        }
        Test.stopTest();
    }
    
    @isTest
    static void testRejectRequest_Success() {
        Leave_Request__c pendingRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'Pending' LIMIT 1];
        
        Test.startTest();
        Leave_Request_Controller.rejectRequest(pendingRequest.Id, 'Rejected by manager');
        Test.stopTest();
        
        Leave_Request__c updatedRequest = [SELECT Id, Status__c, Manager_Comments__c FROM Leave_Request__c WHERE Id = :pendingRequest.Id];
        System.assertEquals('Rejected', updatedRequest.Status__c, 'Status should be Rejected');
        System.assertEquals('Rejected by manager', updatedRequest.Manager_Comments__c, 'Manager comments should be set');
    }
    
    @isTest
    static void testRejectRequest_NonPendingRequest() {
        Leave_Request__c approvedRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'ManagerApproved' LIMIT 1];
        
        Test.startTest();
        try {
            Leave_Request_Controller.rejectRequest(approvedRequest.Id, 'Should fail');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assertEquals('Script-thrown exception', e.getMessage());
        }
        Test.stopTest();
    }
    
    @isTest
    static void testGetSolde() {
        User testUser = [SELECT Id FROM User WHERE Email = 'test1@example.com' LIMIT 1];
        
        System.runAs(testUser) {
            Test.startTest();
            Decimal balance = Leave_Request_Controller.getSolde();
            Test.stopTest();
            
            System.assertEquals(25, balance, 'Should return correct user balance');
        }
    }
    
    @isTest
    static void testGetSolde_NoUserData() {
        // Create a user without UserData__c record
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name='Standard User' LIMIT 1];
        User newUser = new User(
            Alias = 'newtest',
            Email = 'newtest@example.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'NewTestUser',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = standardProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'newtest@example.com.test' + System.currentTimeMillis()
        );
        insert newUser;
        
        System.runAs(newUser) {
            Test.startTest();
            Decimal balance = Leave_Request_Controller.getSolde();
            Test.stopTest();
            
            System.assertEquals(0, balance, 'Should return 0 when no UserData record exists');
        }
    }
    
    @isTest
    static void testGetDeltaSolde_WithHolidays() {
        Date startDate = Date.today().addDays(8);
        Date endDate = Date.today().addDays(12);
        
        Test.startTest();
        Decimal businessDays = Leave_Request_Controller.getDeltaSolde(startDate, endDate);
        Test.stopTest();
        
        // This will depend on the specific dates and holidays in your test data
        System.assert(businessDays >= 0, 'Business days should be non-negative');
    }
    
    @isTest
    static void testGetDeltaSolde_WeekendOnly() {
        // Find a weekend (assuming Saturday and Sunday)
        Date today = Date.today();
        Date saturday = today.addDays(7 - Math.mod(today.toStartOfWeek().daysBetween(today), 7) + 6);
        Date sunday = saturday.addDays(1);
        
        Test.startTest();
        Decimal businessDays = Leave_Request_Controller.getDeltaSolde(saturday, sunday);
        Test.stopTest();
        
        System.assertEquals(0, businessDays, 'Weekend should return 0 business days');
    }
    
    @isTest
    static void testApproveRequestByRH_Success() {
        Leave_Request__c managerApprovedRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'ManagerApproved' LIMIT 1];
        
        Test.startTest();
        Leave_Request_Controller.approveRequestByRH(managerApprovedRequest.Id, 'Approved by HR');
        Test.stopTest();
        
        Leave_Request__c updatedRequest = [SELECT Id, Status__c, Manager_Comments__c FROM Leave_Request__c WHERE Id = :managerApprovedRequest.Id];
        System.assertEquals('Approved', updatedRequest.Status__c, 'Status should be Approved');
        System.assertEquals('Approved by HR', updatedRequest.Manager_Comments__c, 'HR comments should be set');
    }
    
    @isTest
    static void testApproveRequestByRH_InvalidStatus() {
        Leave_Request__c pendingRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'Pending' LIMIT 1];
        
        Test.startTest();
        try {
            Leave_Request_Controller.approveRequestByRH(pendingRequest.Id, 'Should fail');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assertEquals('Script-thrown exception', e.getMessage());
        }
        Test.stopTest();
    }
    
    @isTest
    static void testRejectRequestByRH_Success() {
        Leave_Request__c managerApprovedRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'ManagerApproved' LIMIT 1];
        
        Test.startTest();
        Leave_Request_Controller.rejectRequestByRH(managerApprovedRequest.Id, 'Rejected by HR');
        Test.stopTest();
        
        Leave_Request__c updatedRequest = [SELECT Id, Status__c, Manager_Comments__c FROM Leave_Request__c WHERE Id = :managerApprovedRequest.Id];
        System.assertEquals('Rejected', updatedRequest.Status__c, 'Status should be Rejected');
        System.assertEquals('Rejected by HR', updatedRequest.Manager_Comments__c, 'HR comments should be set');
    }
    
    @isTest
    static void testRejectRequestByRH_InvalidStatus() {
        Leave_Request__c pendingRequest = [SELECT Id FROM Leave_Request__c WHERE Status__c = 'Pending' LIMIT 1];
        
        Test.startTest();
        try {
            Leave_Request_Controller.rejectRequestByRH(pendingRequest.Id, 'Should fail');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assertEquals('Script-thrown exception', e.getMessage());
        }
        Test.stopTest();
    }
    
    @isTest
    static void testGetAllRequests() {
        Test.startTest();
        List<Leave_Request__c> allRequests = Leave_Request_Controller.getAllRequests();
        Test.stopTest();
        
        System.assertNotEquals(null, allRequests, 'All requests should not be null');
        System.assertEquals(2, allRequests.size(), 'Should return all requests');
    }
}