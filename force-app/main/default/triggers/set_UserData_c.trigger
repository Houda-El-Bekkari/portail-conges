trigger set_UserData_c on User (after insert) {
    List<User> activeUsers = [SELECT Id, Name FROM User WHERE IsActive = true];
    System.debug('Active Users: ' + activeUsers.size());

    List<UserData__c> userDataToInsert = new List<UserData__c>();
    for(User u : Trigger.new) {
        if(u.IsActive) {
            UserData__c userData = new UserData__c();
            userData.User__c = u.Id;
            userData.Solde__c = 22;
            userData.Name = u.Name + ' - Leave Data';
            userDataToInsert.add(userData);
        }
    }
    // Insert all UserData records
    if(!userDataToInsert.isEmpty()) {
        insert userDataToInsert;
        System.debug('Created ' + userDataToInsert.size() + ' UserData records');
    }
    

}