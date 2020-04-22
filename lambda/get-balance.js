const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')(process.env.stripeSecretKey);

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);
  
    const params = {
        TableName: 'stripe',
        Key: {
            id: postbody.id
        }
    };
      try {
        var details = await dynamoDbLib.call("get", params);
        if (details.Item === undefined) return response.success({status:true});
        var stripe_acc = {stripe_account:details.Item.stripe_acc_id};
        var balance = await stripe.balance.retrieve(stripe_acc);
        return response.success({status: true, balance: balance});
      } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
    }
  }