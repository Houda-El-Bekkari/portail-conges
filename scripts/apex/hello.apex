List<User> users = [SELECT Id, Name, Solde__c FROM User];
for(User u : users) {
	u.Solde__c = 22;
}
update users;

delete [select Id from Leave_Request__c];