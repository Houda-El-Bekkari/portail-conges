public with sharing class HolidayService {
    @AuraEnabled(cacheable=true)
    public static List<String> getHolidays() {
        List<String> holidayDates = new List<String>();
        String year = String.valueOf(Date.today().year());
        String endpoint = 'https://calendrier.api.gouv.fr/jours-feries/metropole/' + year + '.json';
        
        HttpRequest request = new HttpRequest();
        request.setEndpoint(endpoint);
        request.setMethod('GET');
        request.setTimeout(60000); // 60 seconds timeout

        try {
            Http http = new Http();
            HttpResponse response = http.send(request);

            if (response.getStatusCode() == 200) {
                Map<String, Object> results = (Map<String, Object>)JSON.deserializeUntyped(response.getBody());
                for (String dateStr : results.keySet()) {
                    holidayDates.add(dateStr);
                }
            } else {
                System.debug('Error fetching holidays: ' + response.getStatusCode() + ' ' + response.getStatus());
            }
        } catch (Exception e) {
            System.debug('Exception fetching holidays: ' + e.getMessage());
        }
        return holidayDates;
    }
}