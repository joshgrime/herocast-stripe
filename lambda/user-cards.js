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

          return response.success({status: true, data: []});
        }
        else {
          console.log('Found '+details.Item.customer_id+' in the stripe table');
          var customer = await getCustomer(details.Item.customer_id);
          console.log(customer);

          var payload = [];

          for (let x of customer.sources.data) {
            if (x.object === 'card') {
              payload.push(
                {
                  id: x.id,
                  address_city: x.address_city,
                  address_country: x.address_country,
                  address_line1: x.address_line1,
                  address_line2: x.address_line2,
                  address_zip: x.address_zip,
                  exp_month: x.exp_month,
                  exp_year: x.exp_year,
                  last4: x.last4,
                  name: x.name
                }
              )
            }
          }
          return response.success({status: true, data: payload});
        }

        function getCustomer (id) {
          console.log('Getting customer');
          return new Promise(function (resolve, reject) {
            stripe.customers.retrieve(
              id,
              function(err, customer) {
                if (err) {
                  console.log('Error getting customer details from stripe')
                  reject(err);
                }
                else {
                  console.log('Got customer details from stripe')

                  resolve(customer);
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