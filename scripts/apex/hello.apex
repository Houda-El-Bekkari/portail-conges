String permSetName = 'leave_request_access';

PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = :permSetName LIMIT 1];

Id stdProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id;

List<User> stdUsers = [SELECT Id FROM User WHERE ProfileId = :stdProfileId AND IsActive = TRUE];

List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();

for (User u : stdUsers) {
    // Skip if already assigned
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

if (!assignments.isEmpty()) {
    insert assignments;
    System.debug('Assigned perm set to ' + assignments.size() + ' users.');
} else {
    System.debug('All users already have the permission set.');
}
