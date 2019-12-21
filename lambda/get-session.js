const dynamoDbLib = require("./libs/dynamodb-lib");
const response = require("./libs/response-lib");

module.exports = {
    main: async function (event) {
    
    var postbody = JSON.parse(event.body);
  
    const params = {
        TableName: 'transactions',
        Key: {
            id: postbody.transactid
        }
    };

      try {
        var details = await dynamoDbLib.call("get", params);
        if (details.Item === undefined) return response.success({status:false});
        if (details.Item.playerid !== postbody.userid) return response.success({status:false});
        return response.success({status: true, slot: details.Item});
      } catch (e) {
        console.log('Big error!');
        console.log(e);
        return response.failure({ status: false, error: e });
      }
    }
  }