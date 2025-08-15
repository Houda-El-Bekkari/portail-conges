public with sharing class HolidayService {

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getHolidays() {
        List<Map<String, String>> holidays = new List<Map<String, String>>();
        
        try {
            HttpRequest req = new HttpRequest();
            // Named Credentials !!!
            String year = String.valueOf(Date.today().year());
            req.setEndpoint('https://date.nager.at/api/v3/PublicHolidays/' + year + '/MA');
            req.setMethod('GET');
            req.setTimeout(20000);
            
            HttpResponse res = new Http().send(req);
            // use wrapper !!!
            if (res.getStatusCode() == 200) {
                List<Object> apiHolidays = (List<Object>) JSON.deserializeUntyped(res.getBody());
                for (Object obj : apiHolidays) {
                    Map<String, Object> holiday = (Map<String, Object>) obj;
                    holidays.add(new Map<String, String>{
                        'date' => (String) holiday.get('date'),
                        'name' => (String) holiday.get('localName')
                    });
                }
            }
        } catch (Exception e) {
            System.debug('Error: ' + e.getMessage());
        }
        
        return holidays;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Holiday__c> fetchHolidays(Integer year) {
        List<Holiday__c> holidayRecords = new List<Holiday__c>();
        // don't fetch if year exists
        if (year == [SELECT date__c FROM Holiday__c ORDER BY date__c ASC LIMIT 1].date__c.year()) {
            return null;
        }

        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('https://date.nager.at/api/v3/PublicHolidays/' + year + '/MA');
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
                        date__c = Date.valueOf(dateStr),
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
            SELECT Id, Name, date__c 
            FROM Holiday__c 
            ORDER BY Date__c ASC
        ];
    }
}