const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')(process.env.stripeSecretKey);

const platform_cut = 0.09; //9%
const platform_fee = 100; //£1

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);

    const userParams = {
        "TableName": 'stripe',
        "Key": {
            "id": postbody.user_id
        }
    };

    const hostParams = {
        "TableName": 'stripe',
        "Key": {
            "id": postbody.host_id
        }
    };

    const slotParams = {
        "TableName": 'gameslots',
        "Key": {
            "id": postbody.slot_id,
            "hostid": postbody.host_id
        }
    }

      try {
       
        var hostDetails = await dynamoDbLib.call("get", hostParams);
        if (hostDetails.Item === undefined) return response.failure({status: false, error: 'Host has not setup Stripe account.'});

        var slotDetails = await dynamoDbLib.call("get", slotParams);
        if (slotDetails.Item === undefined) return response.failure({status: false, error: 'Slot does not exist.'});
        if (slotDetails.Item.booked !== 0) return response.failure({status: false, error: 'Slot is already booked.'});
        if (postbody.user_id === slotDetails.Item.hostid) return response.failure({status: false, error: 'You cannot book a slot with yourself.'});

        var date = new Date();
        var date2 = date.getTime();
        date2 /= 1000;

        if (slotDetails.Item.timedex < date2) return response.failure({status: false, error: 'Slot is in the past.'});

        var slotDate = slotDetails.Item.date;
        var slotTime = slotDetails.Item.time;
        var dateString = slotDate.substring(6,8) + '-' + slotDate.substring(4,6) + '-' + slotDate.substring(0,4);
        var timeString = slotTime.substring(0,2) + ':' + slotTime.substring(2,4);
        var description = '1 hour game time at '+timeString+', '+dateString+' (UTC).';

        var gameprice;
        if (postbody.type === 'coach') gameprice = 'coachprice';
        else if (postbody.type === 'vs') gameprice  = 'vsprice';
        else if (postbody.type === 'casual') gameprice = 'casualprice';
        var price = slotDetails.Item[gameprice];

        var currency;
        if (slotDetails.Item.locale === 'UK') currency = 'gbp';
        else if (slotDetails.Item.locale === 'EUR') currency = 'eur';
        else currency = 'usd';

        var cancelUrl = 'https://herocast.gg/slot/'+postbody.host_id+'/'+postbody.slot_id;

        var fee = Math.floor(price*platform_cut) + platform_fee;
        price += platform_fee;

        var stripeBody = {
            payment_intent_data: {
                application_fee_amount: fee,
                transfer_data: {
                  destination: hostDetails.Item.stripe_acc_id,
                },
              },
            payment_method_types: ['card'],
            line_items: [{
                name: 'Herocast Gameslot',
                description: description,
                amount: price,
                currency: currency,
                quantity: 1,
            }],
            success_url: 'https://herocast.gg/booking-success?tkn={CHECKOUT_SESSION_ID}&slot='+slotDetails.Item.id,
            cancel_url: cancelUrl,
            mode: 'payment',
            submit_type: 'book',
            client_reference_id: postbody.user_id
        };

        var userDetails = await dynamoDbLib.call("get", userParams);

        if (userDetails.Item !== undefined && userDetails.Item.customer_id !== undefined) {
            stripeBody.customer = userDetails.Item.customer_id;
        }

        const session = await stripe.checkout.sessions.create(stripeBody);

        const gameDetailsParams = {
          "TableName": 'games',
          "Key": {
            "id":postbody.game
          },
          "ProjectionExpression": "#n",
          "ExpressionAttributeNames": {
            '#n' : 'name'
          }
        }
        var gameDetails = await dynamoDbLib.call("get", gameDetailsParams);
        var gameName = gameDetails.Item.name;

        const newTransactParams = {
          TableName: 'transactions',
          Item: {
            id: session.id,
            slotid: postbody.slot_id,
            time: date2,
            locale: session.locale,
            amount: price,
            gameid: postbody.game,
            game: gameName,
            hostid: slotDetails.Item.hostid,
            playerid: postbody.user_id,
            type: postbody.type,
            completed: 0,
            timedex: slotDetails.Item.timedex,
            localtime: slotDetails.Item.localtime
          }
        };
        
        var updateTransactTable = await dynamoDbLib.call("put", newTransactParams);
        return response.success({status: true, data: session});
      } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
    }
  }