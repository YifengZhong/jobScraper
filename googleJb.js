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
exports.entry = async (event, context) => {
  const puppeteerLambda = require('puppeteer-lambda');
  const browser = await puppeteerLambda.getBrowser({
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://careers.google.com/jobs/results/?company=Google&company=Google%20Fiber&company=YouTube&employment_type=FULL_TIME&location=United%20States&q=Software%20Engineer,%20Software%20Developer&skills=javascript',
      { waitUntil: 'networkidle0' });

    let todayJb = [];
    while (true) {
      const obj = await page.evaluate(() => {
        //From here there is no log output
        const searchResult = document.querySelector('#search-results');
        const sections = searchResult.getElementsByClassName('gc-card');
        const jb1 = Array.from(sections).map(x => {
          const url = x.href;
          const title = x.getElementsByClassName('gc-card__title gc-heading gc-heading--beta')[0].innerText.trim();
          return { title, url };
        });
        let hasNextInternal = true;
        const nextHref = document.querySelector('#jump-content > div.gc-l-split > main > div.gc-p-results.gc-h-flex > div:nth-child(3) > div > div > div > a:nth-child(2)');
        if (nextHref && nextHref.style.display !== 'none') {
          //nextHref.click();
        } else {
          hasNextInternal = false;
        }
        return { jb1, hasNextInternal, url: nextHref.href };
        //untill here no log output
      });
      todayJb = [...todayJb, ...obj.jb1];
      if (obj.hasNextInternal) {
        await page.goto(obj.url,
          { waitUntil: 'networkidle0' });
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
        ":eq": 'Google'
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
          listingId: 'Google'
        }
      }).promise();
      // }
    }
    //Save new jobs
    if (todayJb) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: 'Google',
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

    const message = `Google:${todayJb.length}\n${normalizedJobs.join('\n')}`;
    if (message.length > 280) {
      message = `Google has many new jobs published.`
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