'use strict';
const AWS = require('aws-sdk');
const cheerio = require('cheerio');
const Nightmare = require('nightmare')

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

  if (event.body) {
    const requestBody = JSON.parse(event.body);
    receiver = requestBody['receiver'] || "+15153055694";
    sender = requestBody['sender'] || "ok";
    message = requestBody['message'] || "call you from schduller";
  }

  const url = 'https://jobs.netflix.com/search?q=full%20stack&location=Los%20Gatos%2C%20California~Los%20Angeles%2C%20California~Salt%20Lake%20City%2C%20Utah';
  const nightmare = Nightmare({ show: true });

  // Request making using nightmare
  nightmare
    .goto(url)
    //.wait('body')
    // .click('button._2AkmmA._29YdH8')
    // .type('input.LM6RPg', 'nodejs books')
    // .click('button.vh79eN')
    .wait('div.css-17670uj.exb5qdx0')
    .evaluate(() => document.querySelector('body').innerHTML)
    .end()
    .then(response => {
      message = getData(response);
      sns.publish({
        Message: formatMessage(message),
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
          callback(null, respond(200, data))
        })
        .catch(err => {
          console.log("Sending failed", err);
          callback(null, respond(500, err))
        });
    }).catch(err => {
      console.log(err);
    });
  const formatMessage = msg => {
    return msg.map(record => {
      return `title:${record.title}, link: https://jobs.netflix.com${record.link} `;
    }).join(';')
  }
  // Parsing data using cheerio
  let getData = html => {
    let data = [];
    const $ = cheerio.load(html);
    $('div.css-17670uj.exb5qdx0').each((row, raw_element) => {
      $(raw_element).find('section').each((i, elem) => {
        let title = $(elem).find('a:nth-child(1)').text();
        let link = $(elem).find('a:nth-child(1)').attr('href');
        if (title) {
          data.push({
            title: title,
            link: link
          });
        }
      });
    });
    return data;
  }
}
