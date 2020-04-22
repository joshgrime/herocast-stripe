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