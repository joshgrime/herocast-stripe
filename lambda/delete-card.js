const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')(process.env.stripeSecretKey);

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);
  
    const params = {
        TableName: 'stripe',
        Key: {
            id: postbody.user_id
        }
    };
      try {
        var details = await dynamoDbLib.call("get", params);
        console.log('Getting user '+postbody.user_id+' from stripe table');
        if (details.Item === undefined || details.Item.customer_id === undefined) {
          console.log('Undefined in the stripe table');

          return response.success({status: false, error: 'No Stripe user found.'});
        }
        else {
          console.log('Found '+details.Item.customer_id+' in the stripe table');
          var deletion = await delCard(details.Item.customer_id, postbody.card_id);
          return response.success({status: true});
        }

        function delCard (cus_id, card_id) {
          console.log('Deleting card');
          return new Promise(function (resolve, reject) {
            stripe.customers.deleteSource(
              cus_id, card_id,
              function(err, confirmation) {
                if (err) {
                  console.log('Error deleting card from stripe')
                  reject(err);
                }
                else if (confirmation.deleted === true) {
                  console.log('Deleted from stripe');
                  resolve(confirmation);
                }
                else {
                console.log('Error deleting card from stripe')
                  reject(err);
                }
              }
            );
          })
        }

      } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
    }
  }