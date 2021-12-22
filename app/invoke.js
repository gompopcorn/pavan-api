const { Gateway, Wallets, TxEventHandler, GatewayOptions, DefaultEventHandlerStrategies, TxEventHandlerFactory } = require('fabric-network');
const fs = require('fs');
const path = require("path")
const log4js = require('log4js');
const logger = log4js.getLogger('BasicNetwork');
const util = require('util')
const colors = require("colors")

// const createTransactionEventHandler = require('./MyTransactionEventHandler.ts')

const helper = require('./helper')

// const createTransactionEventHandler = (transactionId, network) => {
//     /* Your implementation here */
//     const mspId = network.getGateway().getIdentity().mspId;
//     const myOrgPeers = network.getChannel().getEndorsers(mspId);
//     return new MyTransactionEventHandler(transactionId, network, myOrgPeers);
// }

// let counter = 0;

const invokeTransaction = async (channelName, chaincodeName, fcn, args, username, orgName, transientData, numOfAdds) => 
{
    try {
        logger.debug(util.format('\n============ invoke transaction on channel %s ============\n', channelName));

        const ccp = await helper.getCCP(orgName);

        // Create a new file system based wallet for managing identities.
        const walletPath = await helper.getWalletPath(orgName) //path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        // console.log(message); console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        let identity = await wallet.get(username);
        if (!identity) {
            console.log(`An identity for the user ${username} does not exist in the wallet, so registering user`);
            return("The identity NOT found.");
        }

        const connectOptions = {
            wallet, identity: username, discovery: { enabled: true, asLocalhost: true },
            // eventHandlerOptions: {
            //     commitTimeout: 100,
            //     strategy: DefaultEventHandlerStrategiestrategy: DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTs.NETWORK_SCOPE_ALLFORTX
            // }
            // transaction: {
            //     strategy: createTransactionEventhandler()
            // }
        }


        
        // console.log("***************************************");
        // console.log("***************************************");
        // // console.log(identity.credentials.certificate);
        // console.log("***************************************");
        // console.log("***************************************");

        // const connectOptions = {
        //     wallet, 
        //     identity: username, 

        //     clientTlsIdentity: username,

        //     tlsInfo: {
        //         certificate: identity.credentials.certificate, 
        //         key: identity.credentials.privateKey
        //     }, 

        //     discovery: { 
        //         enabled: true, 
        //         asLocalhost: true 
        //     },
        // }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, connectOptions);

        
        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork(channelName);
        
        const contract = network.getContract(chaincodeName);

        let result
        let message;
        if (fcn === "createCar") 
        {
            try {                
                result = await contract.submitTransaction(fcn, args[0], args[1], args[2], args[3], args[4]);
                // result = await contract.submitTransaction(fcn, args[0], args[1], args[2], args[3], args[4], 
                //     args[5], args[6], args[7], args[8]);
                
                // message = `Successfully added the car asset with make ${args[1]}`;
                
                // // log the 'message' in a file
                // fs.appendFile('myUpdateLogs.txt', `Successfully added the car asset with make ${args[1]}\n`, function (err) {
                //     if (err) throw err;
                // }); 


                message = `Successfully added the car asset with key ${args[0]}`;
                // counter++;
                
                // console.log(colors.green(message));

                // if (counter == numOfAdds) {
                //     counter = 0;
                //     console.log(colors.blue("DONE"));
                // }

                // // log the 'message' in a file
                // fs.appendFile('myUpdateLogs.txt', `Successfully added the car asset with key ${args[0]}\n`, function (err) {
                //     if (err) throw err;
                // }); 
            }
            catch(error) {
                console.log("------------ Error in createCar func ------------");
                console.log(error);
                console.log("------------------------------------------------");
                return;
            }
        } 


        


        else if (fcn === "changeCarOwner") {
            result = await contract.submitTransaction(fcn, args[0], args[1]);
            message = `Successfully changed car owner with key ${args[0]} to ${args[1]}`; 
        } 
        

        else {
            return `Invocation require either createCar or changeCarOwner as function but got ${fcn}`
        }


        await gateway.disconnect();
        return message;
    } 
    
    catch (error) {

        console.log(`Getting error: ${error}`)
        return error.message

    }
}

exports.invokeTransaction = invokeTransaction;