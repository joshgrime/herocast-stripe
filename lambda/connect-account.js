const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')(process.env.stripeSecretKey);

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);

    try {
    var token = await stripe.oauth.token({ 
      grant_type: 'authorization_code',
      code: postbody.stripe_code,
    });

    console.log(token);
  
      const params = {
          TableName: 'stripe',
          Item: {
              id: postbody.user_id,
              stripe_acc_id: token.stripe_user_id,
              access_token: token.access_token,
              refresh_token: token.refresh_token
          }
      };

      const updateParams = {
        TableName: 'users',
        Key: {
          id: postbody.user_id
        },
        UpdateExpression: 'SET #sc = :s',
        ExpressionAttributeNames: {
          '#sc' : 'stripeConnected'
        },
        ExpressionAttributeValues: {
          ':s' : 1
        }
      };
  
        var details = await dynamoDbLib.call("put", params);
        var details2 = await dynamoDbLib.call("update", updateParams);
        return response.success({status: true});
     
   } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
  }
}