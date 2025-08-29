trigger AssignLeaveRequestPermSet on User (after insert, after update) {
    // Get the Permission Set Id
    PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'leave_request_access' LIMIT 1];
    // Get Standard User Profile Id
    Id stdProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id;

    List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();

    for (User u : Trigger.new) {
        if (u.ProfileId == stdProfileId && u.IsActive) {
            // Check if already assigned
            Boolean alreadyAssigned = [
                SELECT COUNT() 
                FROM PermissionSetAssignment 
                WHERE AssigneeId = :u.Id AND PermissionSetId = :ps.Id
            ] > 0;

            if (!alreadyAssigned) {
                assignments.add(new PermissionSetAssignment(
                    AssigneeId = u.Id,
                    PermissionSetId = ps.Id
                ));
            }
        }
    }

    if (!assignments.isEmpty()) {
        insert assignments;
    }
}
