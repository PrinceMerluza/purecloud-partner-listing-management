import agentConfig from './config.js';
import test from './test.js';
import partnerAccess from './partner-access.js';

//Load purecloud and create the ApiClient Instance
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
client.setPersistSettings(true, 'listing_management');

// Create API instances
const usersApi = new platformClient.UsersApi();
const notificationsApi = new platformClient.NotificationsApi();
const architectApi = new platformClient.ArchitectApi();
const integrationsApi = new platformClient.IntegrationsApi();

// Global
let user = {};
let listingRequest = {};

// Authenticate
client.loginImplicitGrant(agentConfig.clientId, window.location.href)
.then(() => {
    console.log('PureCloud Auth successful.');

    return usersApi.getUsersMe();
})    
.then((me) => {
    user = me;

    return notificationsApi.postNotificationsChannels();
})
.then((channel) => {
    let topic = `v2.users.${user.id}.conversations.emails`;
    
    let websocket = new WebSocket(channel.connectUri);
    websocket.onmessage = function(message){
        // Parse notification string to a JSON object
        const notification = JSON.parse(message.data);

        // Check if email conversatino related
        if(notification.topicName == topic) {
            // Get participants
            let agent = notification.eventBody
                .participants.find(p => p.purpose == 'agent');
            let customer = notification.eventBody
                .participants.find(p => p.purpose == 'customer');
            if(!agent) return;

            if(agent.state == 'connected'){
                listingRequest = JSON.parse(customer.attributes.listingDetail);
                console.log(listingRequest);
                listingRequestReceived();
            }
        }
    }

    return notificationsApi
        .putNotificationsChannelSubscriptions(channel.id, [
            {
                id: topic
            }
        ]);
})
.then(() => {
    console.log('Subscribed to Email');
    setUp();
})
.catch((e) => {
    console.error(e);
});

function setUp(){
    // TODO: move to view
    let elListingInfo = document.getElementById('listing-info');
    let elListingName = document.getElementById('listing-name');

    elListingInfo.style.visibility = 'hidden';

    var coll = document.getElementsByClassName("collapsible");
    var i;

    for (i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.nextElementSibling;
            if (content.style.display === "block") {
                content.style.display = "none";
            } else {
                content.style.display = "block";
            }
        });
    }
    
    // FOR TESTING PURPOSES ONLY
    listingRequest = test;
    listingRequestReceived();
    // END OF TESTING LOGIC

    partnerAccess.setup(client, platformClient);

    return processTemporaryCredentials()
    .then(() => {

        return partnerAccess.getListingDetails(
            'genesys4', 
            'mypurecloud.com', 
            'b1f69ef0-2565-47c5-aa19-fff13056b75d', 
            '1');
    })
    .then((x) => {
        console.log(x);
    })
    setupButtonHandlers();
}

function listingRequestReceived(){
    return updateListingStatus(2)
    .then(() => {
        console.log('Update dt');

        // TODO: view
        let elAppListingName = document.getElementById('applisting-name');
        let elListingInfo = document.getElementById('listing-info');
        let elListingName = document.getElementById('listing-name');
        let elListingPlatforms = document.getElementById('listing-platforms');
        let elListingVendorName = document.getElementById('listing-vendorName');
        let elListingVendorWebSite = document.getElementById('listing-vendorWebSite');
        let elListingVendorEmail = document.getElementById('listing-vendorEmail');
        let elListingTagLine = document.getElementById('listing-tagLine');
        let elListingShortDescription = document.getElementById('listing-shortDescription');
        let elListingFullDescription = document.getElementById('listing-fullDescription');
        let elListingVideoURL = document.getElementById('listing-videoURL');
        let elListingHelpDocumentation = document.getElementById('listing-helpDocumentation');
        let elListingAppLanguages = document.getElementById('listing-appLanguages');
        let elListingIndustries = document.getElementById('listing-industries');
        let elListingSellingParty = document.getElementById('listing-sellingParty');
        let elListingLicensingClassifications = document.getElementById('listing-licensingClassifications');
        let elListingAppPermissions = document.getElementById('listing-appPermissions');
        let elListingAttestations = document.getElementById('listing-attestations');
        let elListingAppType = document.getElementById('listing-appType');
        // let jsonDump = document.getElementById('json-dump');
        

        elListingInfo.style.visibility = 'visible';
        elAppListingName.innerText = listingRequest.orgName + " | "+ listingRequest.listingDetails.name
        elListingName.innerText = listingRequest.listingDetails.name;
        elListingPlatforms.innerText = listingRequest.listingDetails.platforms;
        elListingVendorName.innerText = listingRequest.listingDetails.vendorName;
        elListingVendorWebSite.innerText = listingRequest.listingDetails.vendorWebSite;
        elListingVendorEmail.innerText = listingRequest.listingDetails.vendorEmail;
        elListingTagLine.innerText = listingRequest.listingDetails.tagLine;
        elListingShortDescription.innerText = listingRequest.listingDetails.shortDescription;
        elListingFullDescription.innerText = listingRequest.listingDetails.fullDescription;
        elListingVideoURL.innerText = listingRequest.listingDetails.videoURL;
        elListingHelpDocumentation.innerText = listingRequest.listingDetails.helpDocumentation;
        elListingAppLanguages.innerText = listingRequest.listingDetails.appLanguages;
        elListingIndustries.innerText = listingRequest.listingDetails.industries;
        elListingSellingParty.innerText = listingRequest.listingDetails.sellingParty;
        elListingLicensingClassifications.innerText = listingRequest.listingDetails.licensingClassifications;
        elListingAppPermissions.innerText = listingRequest.listingDetails.appPermissions;
        elListingAttestations.innerText = listingRequest.listingDetails.attestations;
        elListingAppType.innerText = listingRequest.listingDetails.appType;
        // jsonDump.value = JSON.stringify(listingRequest.listingDetails)
        //                 + '\n\n\n' 
        //                 + JSON.stringify(listingRequest.attachments);
    })
    .catch(e => console.error(e));
}

/**
 * Partner credentials are saved initially in their own separate row
 * in the Data Table because of DataTable/DataAction limitation reasons. 
 * Every time the agent side app starts,it needs to process them and integrate
 * into the data table cells.
 * @returns {Promise}
 */
function processTemporaryCredentials(){
    let tempCreds = [];
    let tempCredCount = 0;

    return architectApi.getFlowsDatatableRows(agentConfig.dataTableId, {
        pageSize: 500,
        showbrief: false
    })
    .then((results) => {
        let processingPromises = [];

        tempCreds = results.entities.filter((row) => {
            return row.key.startsWith('temp_');
        });

        // Process the temporary credentials
        tempCreds.forEach((cred) => {
            console.log(cred);
            let credEnv = ''; // eg mypurecloud.com
            let credKey = cred.key.substring(5);

            let process = new Promise((resolve, reject) => {
                // Get the temp row
                architectApi.getFlowsDatatableRow(
                    agentConfig.dataTableId, 
                    cred.key, 
                    { showbrief: false })
                .then((row) => {
                    // Determine environment that has credentials
                    credEnv = Object.keys(row).find(key => {
                        return key.startsWith('mypurecloud') &&
                        row[key] != "{}";
                    });

                    return architectApi.getFlowsDatatableRow(
                        agentConfig.dataTableId, 
                        credKey[0], 
                        { showbrief: false })
                })
                // Get the row that the creds will be insterted to
                .then((row) => {
                    // Rebuild the cell with the new values
                    let cellObject = JSON.parse(row[credEnv]);
                    cellObject[credKey] = JSON.parse(cred[credEnv]);
                    row[credEnv] = JSON.stringify(cellObject);

                    return architectApi.putFlowsDatatableRow(
                        agentConfig.dataTableId, 
                        row.key,
                        { body: row }
                    )
                })
                // Delete the temp row
                .then(() => {
                    return architectApi.deleteFlowsDatatableRow(
                        agentConfig.dataTableId, 
                        cred.key
                    )
                })
                .then(() => {
                    console.log('Processed temp for ' + credKey);
                    tempCredCount++;
                    resolve();
                })
                .catch((e) => reject(e));
            });

            processingPromises.push(process);
        })

        return Promise.all(processingPromises);
    })
    .then(() => {
        console.log('Finished processing all temporary credentials ' 
                    + tempCredCount);
    })
    .catch(e => console.error(e));
}


function setupButtonHandlers(){
    let btnApprove = document.getElementById('btn-approve');

    btnApprove.addEventListener('click', function(){
        updateListingStatus(4)
        .then(() => alert('Approved!'));
    });
}

// TODO: use consts for the statuses instead of direct int
function updateListingStatus(status){

}