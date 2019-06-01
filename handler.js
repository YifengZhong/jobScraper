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
let getData = html => {
  data = [];
  const $ = cheerio.load(html);
  $('table.itemlist tr td:nth-child(3)').each((i, elem) => {
    data.push({
      title: $(elem).text(),
      link: $(elem).find('a.storylink').attr('href')
    });
  });
  console.log(data);
}
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

  const url = 'https://www.flipkart.com/';
  const nightmare = Nightmare({ show: true });

  // Request making using nightmare
  nightmare
    .goto(url)
    .wait('body')
    .click('button._2AkmmA._29YdH8')
    .type('input.LM6RPg', 'nodejs books')
    .click('button.vh79eN')
    .wait('div.bhgxx2')
    .evaluate(() => document.querySelector('body').innerHTML)
    .end()
    .then(response => {
      console.log(getData(response));
    }).catch(err => {
      console.log(err);
    });

  // Parsing data using cheerio
  let getData = html => {
    let data = [];
    const $ = cheerio.load(html);
    $('div._1HmYoV._35HD7C:nth-child(2) div.bhgxx2.col-12-12').each((row, raw_element) => {
      $(raw_element).find('div div div').each((i, elem) => {
        let title = $(elem).find('div div a:nth-child(2)').text();
        let link = $(elem).find('div div a:nth-child(2)').attr('href');
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
