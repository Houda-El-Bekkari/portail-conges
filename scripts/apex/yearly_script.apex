List<UserData__c> users = [SELECT Id, Solde__c FROM UserData__c];
for (UserData__c user : users) {
    user.Solde__c = 22;
}
update users;
HolidayService.fetchHolidays(Date.today().year() + 1);