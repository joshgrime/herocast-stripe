const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')('sk_test_gP2WNcsVXhZU2lqTXcsrkyGT00ZpopO00Z');

module.exports = {
    main: async function (event) {

    const sig = event.headers['Stripe-Signature'];
    var event;
    try {
        event = stripe.webhooks.constructEvent(event.body, sig, 'whsec_KylNFjGTxGYUHsMRAOMeX6O8dbhq9X84');
    }
    catch (err) {
        return response.failure(event);
    }

    const updateParams = {
        TableName: 'transactions',
        Key: {
          id: event.data.object.id
        },
        UpdateExpression: 'SET #sc = :s',
        ExpressionAttributeNames: {
          '#sc' : 'completed'
        },
        ExpressionAttributeValues: {
          ':s' : 1
        }
      };

    try {
        var details = await dynamoDbLib.call("update", updateParams);
        return response.success({status: true});
     
   } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
  }
}