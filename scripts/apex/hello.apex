// First, let's see what users exist
List<User> activeUsers = [SELECT Id, Name FROM User WHERE IsActive = true];
System.debug('Active Users: ' + activeUsers.size());

// Create UserData__c records for all active users
List<UserData__c> userDataToInsert = new List<UserData__c>();

for(User u : activeUsers) {
    UserData__c userData = new UserData__c();
    userData.User__c = u.Id;
    userData.Solde__c = 22;
    userData.Name = u.Name + ' - Leave Data'; // Set a name for the record
    userDataToInsert.add(userData);
}

// Insert all UserData records
if(!userDataToInsert.isEmpty()) {
    insert userDataToInsert;
    System.debug('Created ' + userDataToInsert.size() + ' UserData records');
}

// Verify the records were created
List<UserData__c> createdRecords = [SELECT Id, Name, User__c, Solde__c FROM UserData__c];
System.debug('Total UserData records now: ' + createdRecords.size());

// Check current user specifically
List<UserData__c> myRecord = [SELECT Id, User__c, Solde__c FROM UserData__c WHERE User__c = :UserInfo.getUserId()];
System.debug('My UserData record: ' + myRecord);