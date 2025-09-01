// Get Standard User Profile ID
List<Profile> standardProfiles = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];

if (standardProfiles.isEmpty()) {
    System.debug('Standard User profile not found');
    return;
}

Id standardProfileId = standardProfiles[0].Id;

// Get Permission Set ID
List<PermissionSet> permissionSets = [SELECT Id FROM PermissionSet WHERE Name = 'leave_request_access' LIMIT 1];

if (permissionSets.isEmpty()) {
    System.debug('Permission set leave_request_access not found');
    return;
}

Id permissionSetId = permissionSets[0].Id;

// Find all Standard Users with the permission set assigned
List<PermissionSetAssignment> assignmentsToDelete = [
    SELECT Id, AssigneeId, Assignee.Name 
    FROM PermissionSetAssignment 
    WHERE PermissionSetId = :permissionSetId 
    AND Assignee.ProfileId = :standardProfileId
    AND Assignee.IsActive = true
];

System.debug('Found ' + assignmentsToDelete.size() + ' permission set assignments to remove');

if (assignmentsToDelete.isEmpty()) {
    System.debug('No permission set assignments found for Standard Users');
    return;
}

// Log which users will be affected
for (PermissionSetAssignment psa : assignmentsToDelete) {
    System.debug('Removing permission set from user: ' + psa.Assignee.Name + ' (ID: ' + psa.AssigneeId + ')');
}

try {
    // Delete the permission set assignments
    delete assignmentsToDelete;
    System.debug('Successfully removed permission set assignments from ' + assignmentsToDelete.size() + ' Standard Users');
} catch (Exception e) {
    System.debug('Error removing permission set assignments: ' + e.getMessage());
    System.debug('Stack trace: ' + e.getStackTraceString());
}

// Verify removal
List<PermissionSetAssignment> remainingAssignments = [
    SELECT Id, Assignee.Name 
    FROM PermissionSetAssignment 
    WHERE PermissionSetId = :permissionSetId 
    AND Assignee.ProfileId = :standardProfileId
    AND Assignee.IsActive = true
];

System.debug('Remaining assignments after deletion: ' + remainingAssignments.size());