// delete duplicates from org records
List<Holiday__c> h= HolidayService.fetchHolidays(2025);
List<Holiday__c> holidays = HolidayService.getHolidays_MA();
for (Holiday__c holiday : holidays) {
        System.debug(holiday.Name + ' - ' + holiday.Date__c);
}