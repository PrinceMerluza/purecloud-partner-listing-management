import view from './view.js';
import config from '../config/config.js';

//Load purecloud and create the ApiClient Instance
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

// Create API instances
const contentManagementApi = new platformClient.ContentManagementApi();
const groupsApi = new platformClient.GroupsApi();
const usersApi = new platformClient.UsersApi();

// Globals
let managerGroup = null;

// Authenticate
// TODO: regional authentication
client.loginImplicitGrant('e7de8a75-62bb-43eb-9063-38509f8c21af', 
                        'http://localhost:8080/index.html')
.then(() => {
    console.log('PureCloud Auth successful.');

    // Add modals to DOM
    view.addModalsToDocument();

    view.showLoader('Please wait...');
    return setUp(); 
})
.then(() => {
    view.hideLoader();
})    
.catch((e) => {
    console.error(e);
});

/**
 * Setup the the page and all authentication and data required
 */
function setUp(){
    // Get the id of the managers group and assign 
    return groupsApi.postGroupsSearch({
        "query": [
            {
                "fields": ["name"],
                "value": config.prefix,
                "operator": "AND",
                "type": "STARTS_WITH"
            }
        ]
    })
    .then((result) => {
        if(result.total > 0){
            console.log('Group detected.');
            managerGroup = result.results[0];
        } else {
            throw new Error('Manager group not found');
        }
        
        return checkUserAccess();
    })
    .then(userHasAccess => {
        if(!userHasAccess) alert('You don\'t have access to the group.');
        // TODO: Page that will provide access to the group workspace

        console.log('User has access to group.');

        // Display workspaces that are listings
        return reloadListings();
    })
    .catch((e) => {
        console.error(e);
    });
}

/**
 * Check if user is part of the group for workspace access.
 */
function checkUserAccess(){
    return usersApi.getUsersMe({
        'expand': ['groups']
    })
    // Check if user is included in app group
    .then((user) => user.groups.map(g => g.id).indexOf(managerGroup.id) >= 0)
    .catch(e => console.error(e));
}

/**
 * Get current listing workspaces to display to page
 */
function reloadListings(){
    view.showLoader('Loading listings...');

    return contentManagementApi.getContentmanagementWorkspaces({
        'pageSize': 100,
        'access': ['content']
    })
    .then((workspaces) => {
        let listings = workspaces.entities
                        .filter(ws => ws.name.startsWith(config.prefix));
        view.showListings('listing-cards-container', listings);

        console.log('Listed all listings');

        view.hideLoader();
    })
    .catch((e) => {
        console.error(e);
    });
}

/**
 * Create a new listing workspace
 * @param {String} listingName 
 */
function createNewListing(listingName){
    view.hideCreationModal();
    view.showLoader('Creating listing...')

    let newWorkspaceId = null;

    // Create the workspace for the listing
    contentManagementApi.postContentmanagementWorkspaces({
        name: config.prefix + listingName
    })
    // Add group as member of workspace
    .then((workspace) => {
        newWorkspaceId = workspace.id;

        return contentManagementApi.putContentmanagementWorkspaceMember(
            newWorkspaceId,
            managerGroup.id,
            {
                "memberType": "GROUP"
            }
        );
    })
    .then(() => {
        console.log("Assigned group to workspace.");

        // Create a doument that will have the latest version
        return contentManagementApi.postContentmanagementDocuments({
            name: 'current',
            workspace: {
                id: newWorkspaceId
            },
            tags: ['listing-data']
        });
    })
    .then(() => {
        console.log("Creted document for lsiting data");

        view.hideLoader();
        return reloadListings();
    })
    .catch(e => console.error(e));
}

function showListingDeletionModal(id){
    view.showYesNoModal('Delete Listing', 
    'Are you sure you want  to delete this listing?',
    function(){
        view.showLoader('Deleting listing...');

        contentManagementApi.deleteContentmanagementWorkspace(id)
        .then(() => {
            console.log('Deleted workspace.');
            view.hideYesNoModal();
            view.hideLoader();
            
            return reloadListings();
        })
        .catch(e => console.error(e));
    },
    function(){
        view.hideYesNoModal();
    })
}


// Global exposition
window.createNewListing = createNewListing;
window.showListingDeletionModal = showListingDeletionModal;

window.showCreationModal = view.showCreationModal;
window.hideCreationModal = view.hideCreationModal;

