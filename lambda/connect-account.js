const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);
  
      const params = {
          TableName: 'stripe',
          Item: {
              id: postbody.user_id,
              stripe_acc_id: postbody.stripe_account_id,
              access_token: postbody.access_token,
              refresh_token: postbody.refresh_token
          }
      };

      const params2 = {
        TableName: 'users',
        Item: {
            id: postbody.user_id,
            stripeConnected: 1
        }
    };
  
      try {
        var details = await dynamoDbLib.call("put", params);
        var details2 = await dynamoDbLib.call("put", params2);
        return response.success({status: true});
      } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
    }
  }