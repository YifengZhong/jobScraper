'use strict';
const AWS = require('aws-sdk');
const cheerio = require('cheerio');
//const Nightmare = require('nightmare')

const sns = new AWS.SNS();

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIA4KMFVEJQM523BCP2',
  secretAccessKey: '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',
  //endpoint: new AWS.Endpoint('http://localhost:3000'),
});
const successResponse = (data) => {
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
      callback(null, successResponse(data.Body.toString('base64')));
      return;
    });
  } catch (err) {
    console.log('error in getGrowerById: ', err);
    return errorResponse(500, 'Error Fetching Grower');
  }
  // return {
  //   statusCode: 200,
  //   body: JSON.stringify({
  //     message: 'Hello ,this is my first Lambda function.',
  //   }),
  // };
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

  if (event.body) {
    const requestBody = JSON.parse(event.body);
    receiver = requestBody['receiver'] || "+15153055694";
    sender = requestBody['sender'] || "ok";
    message = requestBody['message'] || "call you from schduller";
  }

  const url = 'https://jobs.netflix.com/search?q=full%20stack&location=Los%20Gatos%2C%20California~Los%20Angeles%2C%20California~Salt%20Lake%20City%2C%20Utah';
  // const nightmare = Nightmare({ show: true });

  // // Request making using nightmare
  // nightmare
  //   .goto(url)
  //   //.wait('body')
  //   // .click('button._2AkmmA._29YdH8')
  //   // .type('input.LM6RPg', 'nodejs books')
  //   // .click('button.vh79eN')
  //   .wait('div.css-17670uj.exb5qdx0')
  //   .evaluate(() => document.querySelector('body').innerHTML)
  //   .end()
  //   .then(response => {
  //     message = getData(response);
  //     sns.publish({
  //       Message: formatMessage(message),
  //       MessageAttributes: {
  //         'AWS.SNS.SMS.SMSType': {
  //           DataType: 'String',
  //           StringValue: 'Promotional'
  //         },
  //         'AWS.SNS.SMS.SenderID': {
  //           DataType: 'String',
  //           StringValue: sender
  //         },
  //       },
  //       PhoneNumber: receiver
  //     }).promise()
  //       .then(data => {
  //         callback(null, respond(200, data))
  //       })
  //       .catch(err => {
  //         console.log("Sending failed", err);
  //         callback(null, respond(500, err))
  //       });
  //   }).catch(err => {
  //     console.log(err);
  //   });
  // const formatMessage = msg => {
  //   return msg.map(record => {
  //     return `title:${record.title}, link: https://jobs.netflix.com${record.link} `;
  //   }).join(';')
  // }
  // // Parsing data using cheerio
  // let getData = html => {
  //   let data = [];
  //   const $ = cheerio.load(html);
  //   $('div.css-17670uj.exb5qdx0').each((row, raw_element) => {
  //     $(raw_element).find('section').each((i, elem) => {
  //       let title = $(elem).find('a:nth-child(1)').text();
  //       let link = $(elem).find('a:nth-child(1)').attr('href');
  //       if (title) {
  //         data.push({
  //           title: title,
  //           link: link
  //         });
  //       }
  //     });
  //   });
  //   return data;
  // }
}
