'use strict';
const AWS = require('aws-sdk');
const sns = new AWS.SNS();
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

  try {
    console.log('before newPage');
    const page = await browser.newPage();
    await page.goto('https://jobs.netflix.com/search?q=full%20stack%20&location=Los%20Gatos%2C%20California~Los%20Angeles%2C%20California',
      { waitUntil: 'networkidle0' });
    console.log('before evaluate');
    const jb1 = await page.evaluate(() => {
      const sections = document.getElementsByClassName('css-ualdm4 e1rpdjew3');
      const jb1 = Array.from(sections).map(x => {
        const url = x.getElementsByTagName('a')[0].href;
        const title = x.getElementsByTagName('h4')[0].innerText;
        return { title, url };
      });
      //parseDoc();
      document.querySelector('#__next > div > main > section > div > div > div > div > div.css-v8ggj5.e1j2lb9k1 > div.css-1l4w6pd.e1wiielh2 > div > a:nth-child(3)').click();
      return jb1;
    });
    await page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' });
    const jb2 = await page.evaluate(() => {
      const sections = document.getElementsByClassName('css-ualdm4 e1rpdjew3');
      const jb2 = Array.from(sections).map(x => {
        const url = x.getElementsByTagName('a')[0].href;
        const title = x.getElementsByTagName('h4')[0].innerText;
        return { title, url };
      });
      return jb2;
    });
    const todayJb = [...jb1, ...jb2];

    console.log('before dynamo');
    const dynamo = new AWS.DynamoDB.DocumentClient()
    const allRecords = await dynamo.scan({
      TableName: 'scrapperjobs'
    }).promise();
    let newJob = todayJb;
    if (allRecords.Items[0]) {
      const yesterdayJobs = allRecords.Items[0].jobs;
      newJob = getNewJob(yesterdayJobs, todayJb);
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
    console.log('before todayJb');
    //Save new jobs
    if (todayJb) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: new Date().toString(),
          jobs: todayJb
        }
      }).promise();
    }
    if (newJob.length !== 0) {
      //send SMS here
      const receiver = "+15153055694";
      const sender = "aws";
      const normalizedJobs = newJob.map((job, index) => {
        return `${index}. title:${job.title}.\nURL: ${job.url}.`;
      })
      const message = normalizedJobs.join('\n\n');
      console.log("Sending message", message, "to receiver", receiver);
      await sns.publish({
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