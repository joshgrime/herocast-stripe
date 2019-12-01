const AWS = require("aws-sdk");

module.exports = {
  call: function(action, params) {
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    if (action === 'get') return dynamoDb.get(params).promise();
    else if (action === 'batchGet') return dynamoDb.batchGet(params).promise();
    else if (action === 'put') return dynamoDb.put(params).promise();
    else if (action === 'query') return dynamoDb.query(params).promise();
    else if (action === 'update') return dynamoDb.update(params).promise();
    else if (action === 'scan') return dynamoDb.scan(params).promise();
    else if (action === 'delete') return dynamoDb.delete(params).promise();
    else if (action === 'batchWrite') return dynamoDb.batchWrite(params).promise();
  }
}
