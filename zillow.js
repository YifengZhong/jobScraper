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
    await page.goto('https://careers.zillowgroup.com/List-Jobs/keyword/Javascript',
      { waitUntil: 'networkidle0' });

    let todayJb = [];
    while (true) {
      const obj = await page.evaluate(() => {
        //From here there is no log output
        const searchResults = document.querySelectorAll('tr');
        const jb1 = Array.from(searchResults)
        const jobs = [];
        for (let i = 1; i < jb1.length; i++) {
          const title = jb1[i].querySelector('.JobTitle-cell').innerText.trim();
          const url = jb1[i].querySelector('.JobTitle-cell > a').href;
          jobs.push({ title, url });
        }
        let hasNextInternal = true;
        const nextHref = document.querySelector('#jobGrid0 > div.k-pager-wrap.k-grid-pager.k-widget.k-floatwrap > a:nth-child(4)');
        const style = nextHref.className;
        if (style && !style.includes("disabled")) {
          nextHref.click();
        } else {
          hasNextInternal = false;
        }
        return { jobs, hasNextInternal, next: nextHref };
        //untill here no log output
      });
      todayJb = [...todayJb, ...obj.jobs];
      console.log(todayJb);
      if (obj.hasNextInternal) {
        await sleep(3000);
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
        ":eq": 'Zillow'
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
          listingId: 'Zillow'
        }
      }).promise();
      // }
    }
    //Save new jobs
    if (todayJb) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: 'Zillow',
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

    const message = `Zillow:${todayJb.length}\n${normalizedJobs.join('\n')}`;
    if (message.length > 280) {
      message = `Zillow has many new jobs published.`
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