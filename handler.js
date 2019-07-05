'use strict';
const AWS = require('aws-sdk');
// const chrome = require('chrome-aws-lambda');
// const puppeteer = require('puppeteer-core');
const sns = new AWS.SNS();

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  //endpoint: new AWS.Endpoint('http://localhost:3000'),
});
const successResponsePdf = (data) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/pdf',
    },
    isBase64Encoded: true,
    body: data,
  };
};
const successRespond = (code, body) => {
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
const errorResponse = (statusCode, message) => {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      message: message,
    }),
  };
};
module.exports.hello = (event, context, callback) => {
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
  const params = {
    Bucket: 'pdftest-yifeng',
    Key: 'Confirmation895498.pdf',
  };
  try {
    s3.getObject(params, function (err, data) {
      if (err) {
        throw new Error('Error Fetching Data release');
      }
      console.log("get pdf");
      callback(null, successResponsePdf(data.Body.toString('base64')));
      return;
    });
  } catch (err) {
    console.log('error in getGrowerById: ', err);
    return errorResponse(500, 'Error Fetching Grower');
  }
};

exports.sendSMS = async (event, context) => {
  const puppeteerLambda = require('puppeteer-lambda');
  console.log('before getBrowser');
  const browser = await puppeteerLambda.getBrowser({
    headless: true
  });
  let result = null;
  try {
    const page = await browser.newPage();
    await page.goto('https://example.com');
    result = await page.evaluate(() => {
      let title = document.querySelector('h1').innerText;
      return title;
    }
    );
  } catch (error) {
    console.log(error);
    return errorResponse(500, error);
  } finally {
    await browser.close();
  }
  return successRespond(200, result);
};
// module.exports.sendSMS = (event, context, callback) => {

//   let url = 'https://' + 'www.google.com';
//   // if (!url.startsWith('http')) {
//   //     url = 'https://' + 'www.google.com'; // add protocol if missing
//   // }
//   getScreenshot(url, 'png')
//     .promise()
//     .then(file => callback(null, successResponseImg(file.toString('base64'))))
//     .catch(e => {
//       console.log(e);
//     });
//   return;
// };
  // let receiver = "+15153055694";
  // let sender = "ok";
  // let message = "call you from schduler";
  // console.log(event.body);
  // if (event.body) {
  //   const requestBody = JSON.parse(event.body);
  //   receiver = requestBody['receiver'] || "+15153055694";
  //   sender = requestBody['sender'] || "ok";
  //   message = requestBody['message'] || "call you from schduller";
  // }
  // console.log("Sending message", message, "to receiver", receiver);
  // sns.publish({
  //   Message: message,
  //   MessageAttributes: {
  //     'AWS.SNS.SMS.SMSType': {
  //       DataType: 'String',
  //       StringValue: 'Promotional'
  //     },
  //     'AWS.SNS.SMS.SenderID': {
  //       DataType: 'String',
  //       StringValue: sender
  //     },
  //   },
  //   PhoneNumber: receiver
  // }).promise()
  //   .then(data => {
  //     console.log("1243");
  //     callback(null, respond(200, data))
  //   })
  //   .catch(err => {
  //     console.log("Sending failed", err);
  //     callback(null, respond(500, err))
  //   });
//}