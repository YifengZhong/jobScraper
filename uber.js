'use strict';
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

function getNewJob(yesterdayJobs, result) {
  const yesterdayJobsUrl = yesterdayJobs.map(job => job.url);
  return result.filter(job => {
    return !yesterdayJobsUrl.includes(job.url)
  });
}
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
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
exports.entry = async (event, context) => {
  const puppeteerLambda = require('puppeteer-lambda');
  const browser = await puppeteerLambda.getBrowser({
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://www.uber.com/us/en/careers/list/?query=Javascript&location=USA-California-San%20Francisco',
      { waitUntil: 'networkidle0' });

    let todayJb = [];
    while (true) {
      const obj = await page.evaluate(() => {
        //From here there is no log output
        const searchResults = document.querySelectorAll('#main > div > div > div > div:nth-child(4) > div');
        const jobs = Array.from(searchResults).map(x => {
          const title = x.querySelector('div:nth-child(1) > span > a').innerText;
          const url = x.querySelector('div:nth-child(1) > span > a').href;
          return { title, url };
        });
        let hasNextInternal = true;
        const nextHref = document.querySelector('#main > div > div > div > div:nth-child(5) > button');
        if (nextHref) {
          nextHref.click();
        } else {
          hasNextInternal = false;
        }
        return { jobs, hasNextInternal };
        //untill here no log output
      });
      todayJb = [...todayJb, ...obj.jobs];
      console.log(todayJb);
      if (obj.hasNextInternal) {
        await sleep(6000);
      } else {
        break;
      }
    }

    const dynamo = new AWS.DynamoDB.DocumentClient()
    const allRecords = await dynamo.scan({
      TableName: 'scrapperjobs',
      FilterExpression: "#listingId = :eq",
      ExpressionAttributeNames: {
        "#listingId": "listingId",
      },
      ExpressionAttributeValues: {
        ":eq": 'Uber'
      }
    }).promise();
    let newJob = todayJb;
    if (allRecords.Items[0]) {
      const yesterdayJobs = allRecords.Items[0].jobs;
      newJob = getNewJob(yesterdayJobs, todayJb);
      // Delete old jobs
      // const jobsToDelete = allRecords.Items[0] ? allRecords.Items[0].listingId : null;
      // if (jobsToDelete) {
      await dynamo.delete({
        TableName: 'scrapperjobs',
        Key: {
          listingId: 'Uber'
        }
      }).promise();
      // }
    }
    //Save new jobs
    if (todayJb) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: 'Uber',
          jobs: todayJb
        }
      }).promise();
    }
    //if (newJob.length !== 0) {
    //send SMS here
    const receiver = "+15153055694";
    const sender = "aws";
    const normalizedJobs = newJob.map((job, index) => {
      return `${index}. title:${job.title}.\nURL: ${job.url}.`;
    })

    const message = `Uber:${todayJb.length}\n${normalizedJobs.join('\n')}`;
    if (message.length > 280) {
      message = `Uber has many new jobs published.`
    }

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
    return successRespond(200, newJob);
  } catch (error) {
    console.log(error);
    return errorResponse(500, error);
  } finally {
    await browser.close();
  }
}