public with sharing class HolidayService {

    
    @AuraEnabled(cacheable=true)
    public static List<Holiday__c> fetchHolidays(Integer year) {
        List<Holiday__c> holidayRecords = new List<Holiday__c>();
        // don't fetch if year exists
        // if (year == [SELECT Date__c FROM Holiday__c ORDER BY Date__c ASC LIMIT 1].Date__c.year()) {
        //     return null;
        // }

        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:Holidays_MA/' + year + '/MA');
            req.setMethod('GET');
            req.setTimeout(20000);

            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() == 200) {
                List<Object> apiHolidays = (List<Object>) JSON.deserializeUntyped(res.getBody());
                for (Object obj : apiHolidays) {
                    Map<String, Object> holiday = (Map<String, Object>) obj;
                    String dateStr = (String) holiday.get('date');
                    String nameStr = (String) holiday.get('localName');
                    holidayRecords.add(new Holiday__c(
                        Date__c = Date.valueOf(dateStr),
                        Name = nameStr
                    ));
                }
                if (!holidayRecords.isEmpty()) {
                    insert holidayRecords;
                }
            }
        } catch (Exception e) {
            System.debug('Error: ' + e.getMessage());
        }

        return holidayRecords;
    }

    @AuraEnabled(cacheable=true)
    public static List<Holiday__c> getHolidays_MA() {
        return [
            SELECT Id, Name, Date__c 
            FROM Holiday__c 
            ORDER BY Date__c ASC
        ];
    }
}