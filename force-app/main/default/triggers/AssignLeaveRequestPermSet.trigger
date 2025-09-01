trigger AssignLeaveRequestPermSet on User (after insert, after update) {
    try {
        
        // Get the Permission Set Id
        List<PermissionSet> psList = [SELECT Id FROM PermissionSet WHERE Name = 'leave_request_access' LIMIT 1];
        List<Profile> profileList = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];

        if (psList.isEmpty() || profileList.isEmpty()) {
            System.debug('Permission Set or Profile not found');
            return;
        }

        Id psId = psList[0].Id;
        Id stdProfileId = profileList[0].Id;

        // Collect User Ids that need assignment (BULK PROCESSING)
        Set<Id> userIdsToAssign = new Set<Id>();
        for (User u : Trigger.new) {
            if (u.ProfileId == stdProfileId && u.IsActive) {
                userIdsToAssign.add(u.Id);
            }
        }

        if (userIdsToAssign.isEmpty()) {
            return;
        }

        Set<Id> alreadyAssignedUserIds = new Set<Id>();
        for (PermissionSetAssignment psa : [
            SELECT AssigneeId FROM PermissionSetAssignment
            WHERE AssigneeId IN :userIdsToAssign AND PermissionSetId = :psId
        ]) {
            alreadyAssignedUserIds.add(psa.AssigneeId);
        }

        List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
        for (Id userId : userIdsToAssign) {
            if (!alreadyAssignedUserIds.contains(userId)) {
                assignments.add(new PermissionSetAssignment(
                    AssigneeId = userId,
                    PermissionSetId = psId
                ));
            }
        }

        if (!assignments.isEmpty()) {
            insert assignments;
        }
        
    } catch (Exception e) {
        System.debug('Error in AssignLeaveRequestPermSet trigger: ' + e.getMessage());
    }
}
