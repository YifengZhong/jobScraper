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
    await page.goto('https://www.linkedin.com/jobs/search/?f_C=1337&keywords=javascript&location=Worldwide&locationId=OTHERS.worldwide',
      { waitUntil: 'networkidle0' });

    let todayJb = [];
    while (true) {
      const obj = await page.evaluate(() => {
        //From here there is no log output
        const searchResult = document.querySelectorAll('.artdeco-list__item');
        const jb1 = Array.from(searchResult).map(x => {
          x.scrollIntoView();
          const url = x.querySelector('h3 > a').href;
          const title = x.querySelector('h3').innerText.trim();
          return { title, url };
        });
        let hasNextInternal = true;
        const nextHref =
          document.querySelector('#ember4 > div.application-outlet > div.authentication-outlet > section.job-search-ext.job-search-ext--two-pane > div.jobs-search-two-pane__wrapper.jobs-search-two-pane__wrapper--two-pane > div > div > div.jobs-search-two-pane__results.display-flex > div.jobs-search-results.jobs-search-results--is-two-pane > div > section > artdeco-pagination > ul > li:nth-child(2) > button');
        if (nextHref) {
          nextHref.click();
        } else {
          hasNextInternal = false;
        }
        return { jb1, hasNextInternal, url: nextHref.href };
        //untill here no log output
      });
      todayJb = [...todayJb, ...obj.jb1];
      if (obj.hasNextInternal) {
        await sleep(2000);
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
        ":eq": 'LinkedIn'
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
          listingId: 'LinkedIn'
        }
      }).promise();
      // }
    }
    //Save new jobs
    if (todayJb) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: 'LinkedIn',
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

    const message = `Today LinkedIn has ${todayJb.length} positions. new jobs are:\n\n${normalizedJobs.join('\n\n')}`;
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