const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')('sk_test_gP2WNcsVXhZU2lqTXcsrkyGT00ZpopO00Z');

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);
   
      try {
        function bigPromise(){
          return new Promise(async function(bigResolve, bigReject) {
            try {
            const params = {
              "TableName": 'stripe',
              "Key": {
                  "id": postbody.user_id
              }
          };
            console.log('Getting user '+postbody.user_id+' from stripe table');
            var details = await dynamoDbLib.call("get", params);
            console.log('Got user: '+details.Item);

            if (details.Item === undefined || details.Item.customer_id === undefined) {
              details.Item ? console.log('No user in stripe table') : console.log('No customer ID for this user in stripe table');
             
              
              var userParams = {
                TableName: 'users',
                Key: {
                    id: postbody.user_id
                }
            };
            console.log('Getting user from users table');
    
            var userDetails = await dynamoDbLib.call("get", userParams);
            console.log('Got user: '+userDetails.Item);
            console.log('Creating stripe user from users table');
    
              //create stripe customer
              stripe.customers.create(
                {
                  description: `Customer for ${userDetails.Item.email}`,
                  email: userDetails.Item.email,
                  metadata: {
                    herocastId: postbody.user_id,
                    herocastUsername: userDetails.Item.username
                  }
                },
                async function(err, customer) {
                  if (err) {
                    bigReject(err);
                  }
                  else {
                    console.log('Stripe customer created');
                    console.log(customer);
                    const params2 = {
                      TableName: 'stripe',
                      Item: {
                          id: postbody.user_id,
                          customer_id: customer.id
                      }
                  };
                  console.log('Creating stripe customer in herocast');
                  await dynamoDbLib.call("put", params2);
                  console.log('Creeted stripe customer in herocast, going to create card');

                  addCard(customer.id, postbody.card);
                  }

                }
              );
            }
            else {
              console.log('User exists, going to create card');
              var stripeCustomerId = details.Item.customer_id;
              addCard(stripeCustomerId, postbody.card);
            }
    
            function addCard(customer, card){
              return new Promise(function (resolve, reject){
              console.log('Creating card token');
                stripe.tokens.create(
                  {card
                    /*card: {
                      number: '4242424242424242',
                      exp_month: 11,
                      exp_year: 2020,
                      cvc: '314',
                    },*/
                  },
                  function(err, token) {
                    if (err) {
                      bigReject(err);
                    }
                    else {
                      console.log('Created card token');
                      console.log(token);
                      console.log('Creating card in stripe');
  
                      stripe.customers.createSource(
                        customer,
                        {source: token.id},
                        function(err, card) {
                          if (err) {
                            bigReject(err);
                          }
                          else {
                            console.log('Card created');
                            bigResolve('Major Success');
                          }
                        }
                      );
                    }   
                  })
                  }
                );
            }
          }
          catch (e) {
            bigReject(e);
          }
        });
        }
        

        var execute = await bigPromise();
        return response.success({status: true, msg: execute});
      } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
    }
  }