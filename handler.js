'use strict';
const AWS = require('aws-sdk');
// const chrome = require('chrome-aws-lambda');
// const puppeteer = require('puppeteer-core');
const sns = new AWS.SNS();
const dynamo = new AWS.DynamoDB.DocumentClient(
  //   {
  //   region: 'localhost',
  //   endpoint: 'http://localhost:8000'
  // }
)
// AWS.config.update({
//   region: 'us-east-1',
//   accessKeyId: '',
//   secretAccessKey: '',
//   //endpoint: new AWS.Endpoint('http://localhost:3000'),
// });
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
function getNewJob(yesterdayJobs, result) {
  const yesterdayJobsUrl = yesterdayJobs.map(job => job.url);
  return result.filter(job => !yesterdayJobsUrl.includes(job.url));
}
exports.sendSMS = async (event, context) => {
  const puppeteerLambda = require('puppeteer-lambda');
  console.log('before getBrowser');
  const browser = await puppeteerLambda.getBrowser({
    headless: true
  });
  let todayJobs = null;
  const allJobs = {
    jobs: [{
      job: 'Donkey Feeder',
      closing: 'Fri Jul 21 2017 00:00:00 GMT+0100',
      location: 'Leeds, UK'
    },
    {
      job: 'Chef',
      closing: 'Fri Jul 21 2017 00:00:00 GMT+0100',
      location: 'Sheffield, UK'
    }
    ],
    listingId: 'Fri Jul 21 2017 14:25:35 GMT+0100 (BST)'
  }
  try {
    const page = await browser.newPage();
    await page.goto('https://jobs.netflix.com/search?q=full%20stack%20&location=Los%20Gatos%2C%20California~Los%20Angeles%2C%20California',
      { waitUntil: 'networkidle0' });

    todayJobs = await page.evaluate(() => {
      const sections = document.getElementsByClassName('css-ualdm4 e1rpdjew3');
      const jbdescription = Array.from(sections).map(x => {
        const url = x.getElementsByTagName('a')[0].href;
        const title = x.getElementsByTagName('h4')[0].innerText;
        return { title, url };
      })
      console.log(jbdescription);
      return jbdescription;
    })
    const dynamo = new AWS.DynamoDB.DocumentClient()
    const allRecords = await dynamo.scan({
      TableName: 'scrapperjobs'
    }).promise();
    let newJob = todayJobs;
    if (allRecords.Items[0]) {
      const yesterdayJobs = allRecords.Items[0].jobs;
      newJob = getNewJob(yesterdayJobs, todayJobs);
      // Delete old jobs
      const jobsToDelete = allRecords.Items[0] ? allRecords.Items[0].listingId : null;
      if (jobsToDelete) {
        await dynamo.delete({
          TableName: 'scrapperjobs',
          Key: {
            listingId: jobsToDelete
          }
        }).promise();
      }
    }



    //Save new jobs
    if (todayJobs) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: new Date().toString(),
          jobs: todayJobs
        }
      }).promise();
    }
    if (newJob.length !== 0) {
      //send SMS here
      let receiver = "+15153055694";
      let sender = "aws";
      let message = newJob;
      console.log("Sending message", message, "to receiver", receiver);
      await sns.publish({
        Message: JSON.stringify(message),
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
      }).promise();
    }
    return successRespond(200, newJob);
  } catch (error) {
    console.log(error);
    return errorResponse(500, error);
  } finally {
    await browser.close();
  }
}