const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')('sk_test_gP2WNcsVXhZU2lqTXcsrkyGT00ZpopO00Z');

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);
  
    const params = {
        TableName: 'stripe-customers',
        Item: {
            id: postbody.user_id,
            payId: postbody.stripe_account_id,
        }
    };

      try {
        var details = await dynamoDbLib.call("get", params);
        var stripe_acc = details.Item.stripe_acc_id;
        var login_link = await stripe.accounts.createLoginLink(stripe_acc);
        return response.success({status: true, link: login_link});
      } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
    }
  }