'use strict';
let AWS = require('aws-sdk');
const sns = new AWS.SNS();

module.exports.hello = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello ,this is my first Lambda function.',
    }),
  };
};

const respond = (code, body) => {
  const response = {
    statusCode: code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body)
  };
  return response;
};
module.exports.sendSMS = (event, context, callback) => {
  let receiver = "+15153055694";
  let sender = "ok";
  let message = "call you from schduler";
  console.log(event.body);
  if (event.body) {
    const requestBody = JSON.parse(event.body);
    receiver = requestBody['receiver'] || "+15153055694";
    sender = requestBody['sender'] || "ok";
    message = requestBody['message'] || "call you from schduller";
  }
  console.log("Sending message", message, "to receiver", receiver);
  sns.publish({
    Message: message,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Promotional'
      },
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: sender
      },
    },
    PhoneNumber: receiver
  }).promise()
    .then(data => {
      console.log("1243");
      callback(null, respond(200, data))
    })
    .catch(err => {
      console.log("Sending failed", err);
      callback(null, respond(500, err))
    });
}
