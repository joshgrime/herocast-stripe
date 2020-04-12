const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");
const stripe = require('stripe')('sk_test_gP2WNcsVXhZU2lqTXcsrkyGT00ZpopO00Z');
const platform_cut = 0.12; //12%
const platform_fee = 1; //a dollar!


module.exports = {
  main: async function (event, context) {
    
    try {
    var postbody = JSON.parse(event.body);

    if (postbody.hostid == postbody.userid) return response.failure({status: false, errorMessage: 'You cannot book a game with yourself.'});
    if (postbody.ingamename === undefined || postbody.ingamename === null) return response.failure({status: false, errorMessage: 'No player ingame name attached'});
    if (postbody.type === undefined || postbody.type === null) return response.failure({status: false, errorMessage: 'No game type found'});
    if (postbody.game === undefined || postbody.game === null) return response.failure({status: false, errorMessage: 'No game found'});
    if (postbody.cardid === undefined || postbody.cardid === null) return response.failure({status: false, errorMessage: 'No card details'});

    var gameprice;
    if (postbody.type === 'coach') gameprice = 'coachprice';
    else if (postbody.type === 'vs') gameprice  = 'vsprice';
    else if (postbody.type === 'casual') gameprice = 'casualprice';
    else if (postbody.type === 'multi') gameprice = 'multiprice';

    else return response.failure({status: false, errorMessage: 'No valid game type specified'});

    var projectionExp = "id, booked, console, #gameprice, locale, #d, #t, playerids, maxSlots, slotsBooked, game, #lt";

    const params = {
        "TableName": "gameslots",
        "Key": {
            "id":postbody.slotid,
            "hostid":postbody.hostid
        },
        "ProjectionExpression": projectionExp,
        "ExpressionAttributeNames": {
          '#d': 'date',
          '#t': 'time',
          '#lt': 'localtime',
          "#gameprice": gameprice
        }
    };

      var gameslotDetails = await dynamoDbLib.call("get", params);

      var date = new Date();
      var date2 = date.getTime();
      date2 /= 1000;

      if (gameslotDetails.Item.timedex < date2) return response.failure({status: false, errorMessage: 'Slot is in the past.'});
      if (gameslotDetails.Item.booked !==0 && postbody.type !== 'multi') return response.failure({status: false, errorMessage: 'Game is already fully booked.'});
      if (gameslotDetails.Item.booked !==0 && postbody.type === 'multi' && (gameslotDetails.Item.maxSlots <= gameslotDetails.Item.slotsBooked)) return response.failure({status: false, errorMessage: 'Game is already fully booked.'});

      var multi_pids;

      if (postbody.type === 'multi') {
         multi_pids = JSON.parse(gameslotDetails.Item.playerids);
         if (multi_pids.length > 0) {
          var mpidCheck = multi_pids.filter(player=>{
            return player.id === postbody.userid;
          });
          if (mpidCheck.length > 0) return response.failure({status: false, errorMessage: 'User is already booked onto this multi-gameslot.'});
         }
      }
      var gameid = postbody.type === 'multi' ? gameslotDetails.Item.game : postbody.game;

      if (postbody.type !== 'multi') {
          
        const hostParams = {
          "TableName": 'users',
          "Key": {
            "id":postbody.hostid
          },
          "ProjectionExpression": "games"
        }

        var hostGameDetails = await dynamoDbLib.call("get", hostParams);
        var hostGames = JSON.parse(hostGameDetails.Item.games);
        var hostGameCheck = hostGames.filter(x=>{
          return x === gameid
        });
        if (hostGameCheck.length === 0) return response.failure({status: false, errorMessage: 'Host does not have selected game on their profile.'}); 
      }
        const gameDetailsParams = {
          "TableName": 'games',
          "Key": {
            "id":gameid
          },
          "ProjectionExpression": "#n",
          "ExpressionAttributeNames": {
            '#n' : 'name'
          }
        }
        var gameDetails = await dynamoDbLib.call("get", gameDetailsParams);

        var gameName = gameDetails.Item.name;

        const connectedAccountParams = {
          "TableName": 'stripe',
          "Key": {
              "id": postbody.hostid
          },
          "ProjectionExpression": "id, stripe_acc_id"
      };

        const customerAccountParams = {
          "TableName": 'stripe',
          "Key": {
              "id": postbody.userid
          },
          "ProjectionExpression": "id, customer_id"
      };

      var customerAccount = await dynamoDbLib.call('get', customerAccountParams);

      if (customerAccount.Item.customer_id === undefined) return response.failure({status: false, errorMessage: 'Customer not found in Stripe.'});

       var connectedAccount = await dynamoDbLib.call('get', connectedAccountParams);

       if (connectedAccount.Item.stripe_acc_id === undefined) return response.failure({status: false, errorMessage: 'Host has no connected Stripe account.'});
        
        var currency = 'usd';
        if (gameslotDetails.Item.locale === 'UK') currency = 'gbp';
        else if (gameslotDetails.Item.locale === 'EUR') currency = 'eur';
        else if (gameslotDetails.Item.locale === 'CAN') currency = 'cad';

        var price = gameslotDetails.Item[gameprice];
        var fee = Math.floor(price*platform_cut) + platform_fee;
        price += platform_fee;

        function stripePromise(){
          var prom = new Promise(function(resolve, reject) {
            stripe.paymentIntents.create(
              {
                amount: price,
                currency: currency,
                confirm: true,
                off_session: false,
                error_on_requires_action: true,
                payment_method: postbody.cardid,
                customer: customerAccount.Item.customer_id,
                application_fee_amount: fee,
                transfer_data: {
                  destination: connectedAccount.Item.stripe_acc_id,
                },
                metadata: {
                  game: gameName,
                  host: postbody.hostid,
                  player: postbody.userid,
                  date: gameslotDetails.Item.date,
                  time: gameslotDetails.Item.time,
                  console: gameslotDetails.Item.console
                }
              },
              function(err, paymentIntent) {
                if (err) reject(err);
                else resolve(paymentIntent);
              }
            )
          });
          prom.catch(e=>{throw new Error(e);})
          return prom;
        }
        
       var makePayment = await stripePromise();
               
      if (makePayment.status !== 'succeeded') return response.failure({status: false, errorMessage: makePayment.status});

    var updateExpression, ExpressionAttributeNames, ExpressionAttributeValues;

      if (multi_pids !== null) {
        multi_pids.push({id:postbody.userid, ingamename: postbody.ingamename});
        var newSlotsBooked = multi_pids.length;
        var newStatus = gameslotDetails.Item.maxSlots <= newSlotsBooked ? 'booked' : 'open';
        var newPlayerIds = JSON.stringify(multi_pids);
        updateExpression = 'SET #b = :true, #p = :ids, #gn = :gameName, #s = :status, #t = :type, #sb = :slotsBooked';
        ExpressionAttributeNames ={
          '#b' : 'booked',
          '#p' : 'playerids',
          '#gn': 'gameName',
          '#s' : 'status',
          "#t" : 'type',
          "#sb": 'slotsBooked'
        };
        ExpressionAttributeValues = {
          ':true' : 1,
          ':ids' : newPlayerIds,
          ':gameName' : gameName,
          ':status' : newStatus,
          ':type': postbody.type,
          ':slotsBooked': newSlotsBooked
        };

      }
      else {
        updateExpression = 'SET #b = :true, #p = :id, #g = :game, #gn = :gameName, #s = :status, #t = :type, #pign = :playerign';
        ExpressionAttributeNames ={
          '#b' : 'booked',
          '#p' : 'playerid',
          '#g' : 'game',
          '#gn': 'gameName',
          '#s' : 'status',
          "#t" : 'type',
          '#pign':'playeringamename'
        };
        ExpressionAttributeValues = {
          ':true' : 1,
          ':id' : postbody.userid,
          ':game' : postbody.game,
          ':gameName' : gameName,
          ':status' : 'booked',
          ':playerign': postbody.ingamename,
          ':type': postbody.type
        };
      }

        const updateGameSlotParams = {
            "TableName": 'gameslots',
            "Key": {
              "id": postbody.slotid,
              "hostid": postbody.hostid
            },
            "UpdateExpression": updateExpression,
            "ExpressionAttributeNames": ExpressionAttributeNames,
            "ExpressionAttributeValues": ExpressionAttributeValues 
          };

          var successFullyBookedGame = await dynamoDbLib.call('update', updateGameSlotParams);

          var d = new Date();
          var recordId = d.getTime();

          if (multi_pids !== null) {
            const createQuickMapParams = {
              "TableName": 'gameslots-multi-map',
              "Item": {
                "timestamp": recordId,
                "playerid": postbody.userid,
                "hostid":postbody.hostid,
                "slotid": postbody.slotid,
                "game": gameName,
                "date": gameslotDetails.Item.date,
                "time": gameslotDetails.Item.time,
                "localtime": gameDetails.Item.localtime
              }
            };
            var createQuickMap = await dynamoDbLib.call('put', createQuickMapParams);
          }
          return response.success({status: true});
    } catch (e) {
      return response.failure({ status: false, errorMessage: 'There was a problem. Please try again later.', e:e });
    }
  }
}