'use strict';

var { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');

const util = require('util');

const getCCP = async (org) => 
{
    let ccpPath;

    if (org == "Org1") {
        ccpPath = path.resolve(__dirname, '..', '..', 'organizations', 'peerOrganizations', 
        'org1.example.com', 'connection-org1.json');
    } 
    else if (org == "Org2") {
        ccpPath = path.resolve(__dirname, '..', '..', 'organizations', 'peerOrganizations', 
        'org1.example.com', 'connection-org2.json');
    } 
    else return null;

    const fileExists = fs.existsSync(ccpPath);

	if (!fileExists) {
		throw new Error(`no such file or directory: ${ccpPath}`);
	}

    const ccpJSON = fs.readFileSync(ccpPath, 'utf8')
    const ccp = JSON.parse(ccpJSON);
    return ccp;
}


const getCaUrl = async (org, ccp) => 
{
    let caURL;

    if (org == "Org1") {
        caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;

    } else if (org == "Org2") {
        caURL = ccp.certificateAuthorities['ca.org2.example.com'].url;
    } 
    
    else return null;
    return caURL;
}

const getCaInfo = async (org, ccp) => 
{
    let caInfo;

    if (org == "Org1") {
        caInfo = ccp.certificateAuthorities['ca.org1.example.com'];

    } else if (org == "Org2") {
        caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
    } 
    
    else return null;
    return caInfo;
}

const getWalletPath = async (org) => 
{
    let walletPath;

    if (org == "Org1") {
        walletPath = path.join(process.cwd(), 'org1-wallet');

    } else if (org == "Org2") {
        walletPath = path.join(process.cwd(), 'org2-wallet');
    } 
    
    else return null;
    return walletPath;
}


const getAffiliation = async (org) => {
    return org == "Org1" ? 'org1.department1' : 'org2.department1';
}


const getRegisteredUser = async (username, userOrg) => 
{
    let ccp = await getCCP(userOrg)

    const caURL = await getCaUrl(userOrg, ccp)
    const ca = new FabricCAServices(caURL);
    
    
    const walletPath = await getWalletPath(userOrg);
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    
    const userIdentity = await wallet.get(username);
    if (userIdentity) {
        console.log(`An identity for the user ${username} already exists in the wallet`);
        var response = {
            success: true,
            message: username + ' enrolled Successfully',
        };
        return response;
    }


    // Check to see if we've already enrolled the admin user.
    let adminIdentity = await wallet.get('admin');
    if (!adminIdentity) {
        console.log('An identity for the admin user "admin" does not exist in the wallet');
        await enrollAdmin(userOrg, ccp);
        adminIdentity = await wallet.get('admin');

        console.log("Admin Enrolled Successfully")
    }
    

    // build a user object for authenticating with the CA
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');
    
    // console.log("******************************************");
    // console.log("******************************************");
    // console.log(provider);
    // console.log("---------");
    // // console.log(adminIdentity);
    // console.log("---------");
    // console.log(adminUser);
    // console.log("******************************************");
    // console.log("******************************************");

    // let secret = "pass"
    let secret;
    try {
        if (username == "superuser") {
            // Register the user, enroll the user, and import the new identity into the wallet.
            secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: username, role: 'client', attrs: [{ name: 'role', value: 'admin', ecert: true }] }, adminUser);

        } else {
            secret = await ca.register({ affiliation: await getAffiliation(userOrg), enrollmentID: username, role: 'client' }, adminUser);

        }

    } catch (error) {
        return error.message
    }

    let enrollment;
    if (username == "superuser") {
        enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: secret, attr_reqs: [{ name: 'role', optional: false }] });

    } else {
        enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: secret });
        // enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: secret, profile: `tls`});

    }


    let x509Identity = {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId: `${userOrg}MSP`,
        type: 'X.509',
    };

    await wallet.put(username, x509Identity);
    console.log(`Successfully registered and enrolled admin user ${username} and imported it into the wallet`);

    var response = {
        success: true,
        message: username + ' enrolled Successfully',
    };
    return response
}

const isUserRegistered = async (username, userOrg) => {
    const walletPath = await getWalletPath(userOrg)
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userIdentity = await wallet.get(username);
    if (userIdentity) {
        console.log(`An identity for the user ${username} exists in the wallet`);
        return true
    }
    return false
}



const enrollAdmin = async (org, ccp) => 
{
    console.log('calling enroll Admin method')

    try 
    {
        const caInfo = await getCaInfo(org, ccp);
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { 
            trustedRoots: caTLSCACerts, 
            verify: true    // verify the server certificate when using TLS
        }, 
        caInfo.caName);

        // Create a new file system based wallet for managing identities.
        const walletPath = await getWalletPath(org) //path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user.
        const identity = await wallet.get('admin');
        if (identity) {
            console.log('An identity for the admin user "admin" already exists in the wallet');
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        // const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw', profile: `tls` });
        
        let x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: `${org}MSP`,
            type: 'X.509',
        };

        await wallet.put('admin', x509Identity);
        console.log('Successfully enrolled admin user "admin" and imported it into the wallet');
        return
    } 

    catch (error) {
        console.error(`Failed to enroll admin user "admin": ${error}`);
    }
}



const registerAndGetSecret = async (username, userOrg) => {
    let ccp = await getCCP(userOrg)

    const caURL = await getCaUrl(userOrg, ccp)
    const ca = new FabricCAServices(caURL);

    const walletPath = await getWalletPath(userOrg)
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userIdentity = await wallet.get(username);
    if (userIdentity) {
        console.log(`An identity for the user ${username} already exists in the wallet`);
        var response = {
            success: true,
            message: username + ' enrolled Successfully',
        };
        return response
    }

    // Check to see if we've already enrolled the admin user.
    let adminIdentity = await wallet.get('admin');
    if (!adminIdentity) {
        console.log('An identity for the admin user "admin" does not exist in the wallet');
        await enrollAdmin(userOrg, ccp);
        adminIdentity = await wallet.get('admin');
        console.log("Admin Enrolled Successfully")
    }

    // build a user object for authenticating with the CA
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');
    let secret;
    try {
        // Register the user, enroll the user, and import the new identity into the wallet.
        secret = await ca.register({ affiliation: await getAffiliation(userOrg), enrollmentID: username, role: 'client' }, adminUser);
        // const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: username, role: 'client', attrs: [{ name: 'role', value: 'approver', ecert: true }] }, adminUser);

    } catch (error) {
        return error.message
    }

    var response = {
        success: true,
        message: username + ' enrolled Successfully',
        secret: secret
    };
    return response

}

exports.getRegisteredUser = getRegisteredUser

module.exports = {
    getCCP: getCCP,
    getWalletPath: getWalletPath,
    getRegisteredUser: getRegisteredUser,
    isUserRegistered: isUserRegistered,
    registerAndGetSecret: registerAndGetSecret

}
