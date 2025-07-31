public with sharing class HolidayService {
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getHolidays() {
        List<Map<String, String>> holidays = new List<Map<String, String>>();

        holidays.add(new Map<String, String>{ 'date' => '2025-01-01', 'name' => 'Nouvel An' });
        holidays.add(new Map<String, String>{ 'date' => '2025-05-01', 'name' => 'Fête du Travail' });
        holidays.add(new Map<String, String>{ 'date' => '2025-07-30', 'name' => 'Fête du Trône' });
        holidays.add(new Map<String, String>{ 'date' => '2025-08-14', 'name' => 'Oued Ed-Dahab' });
        holidays.add(new Map<String, String>{ 'date' => '2025-08-20', 'name' => 'Révolution du Roi et du Peuple' });
        holidays.add(new Map<String, String>{ 'date' => '2025-08-21', 'name' => 'Fête de la Jeunesse' });
        holidays.add(new Map<String, String>{ 'date' => '2025-11-06', 'name' => 'Marche Verte' });
        holidays.add(new Map<String, String>{ 'date' => '2025-11-18', 'name' => 'Fête de l’Indépendance' });
        holidays.add(new Map<String, String>{ 'date' => '2025-03-29', 'name' => 'Aïd al-Fitr (1)' });
        holidays.add(new Map<String, String>{ 'date' => '2025-04-30', 'name' => 'Aïd al-Fitr (2)' });
        holidays.add(new Map<String, String>{ 'date' => '2025-06-06', 'name' => 'Aïd al-Adha (1)' });
        holidays.add(new Map<String, String>{ 'date' => '2025-06-07', 'name' => 'Aïd al-Adha (2)' });
        holidays.add(new Map<String, String>{ 'date' => '2025-06-15', 'name' => '1er Moharram' });
        holidays.add(new Map<String, String>{ 'date' => '2025-09-16', 'name' => 'Maoulid' });

        return holidays;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getHolidays_MA() {
        List<Map<String, String>> holidays = new List<Map<String, String>>();
        
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('https://date.nager.at/api/v3/PublicHolidays/2025/MA');
            req.setMethod('GET');
            req.setTimeout(20000);
            
            HttpResponse res = new Http().send(req);
            
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
}