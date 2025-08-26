List<User> users = [SELECT Id, Name, Profile.Name FROM User where Profile.Name LIKE '%Admin%'];
for (User u : users) {
    System.debug('User: ' + u.Name + ', Profile: ' + u.Profile.Name+' , ProfileId: ' + u.ProfileId);
}