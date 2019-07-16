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
    //const mypromise = page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' });
    await page.goto('https://careers.microsoft.com/us/en/search-results?keywords=javascript',
      { waitUntil: 'networkidle0' });
    const buttons = page.$$('.facet-menu');
    Array.from(buttons).map(async ele => {
      console.log('in click');
      await page.click(ele);
    })
    let todayJb = [];
    while (true) {
      const obj = await page.evaluate(() => {
        //From here there is no log output
        //USA
        if (!document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(3) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(1) > label > input').checked) {
          document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(3) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(1) > label > input').click();
        }
        //Engineering
        if (!document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(6) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(1) > label > input').checked) {
          document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(6) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(1) > label > input').click();
        }
        //Despline
        if (!document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(7) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(1) > label > input').checked) {
          document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(7) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(1) > label > input').click();
        }
        if (!document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(7) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(2) > label > input').checked) {
          document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(7) > div.panel-collapse.collapse.in > div > div.phs-facet-results > ul > li:nth-child(2) > label > input').click();
        }
        //Role type
        if (!document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(9) > div.panel-collapse.collapse.in > div > div > ul > li:nth-child(1) > label > input').checked) {
          document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-4.col-sm-5.addition-padding > section:nth-child(1) > div > div > div.au-target.phs-filter-panels.show > div:nth-child(9) > div.panel-collapse.collapse.in > div > div > ul > li:nth-child(1) > label > input').click();
        }
        const searchResults = document.querySelectorAll('.jobs-list-item');
        const jobs = Array.from(searchResults).map(x => {
          const title = x.querySelector('.job-title').innerText.trim();
          const url = x.querySelector('div > ul > li:nth-child(1) > div > div.left-block.col-xs-12.col-md-10 > div > a').href;
          return { title, url };
        });
        let hasNextInternal = true;
        const nextHref = document.querySelector('body > div.ph-page > div > div.container > div.row > div.col-md-8.col-sm-7 > section > div > div > div:nth-child(3) > div.pagination-block.au-target > ul > li:nth-child(12) > a > ppc-content:nth-child(1)');
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
        await sleep(4000);
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
        ":eq": 'Microsoft'
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
          listingId: 'Microsoft'
        }
      }).promise();
      // }
    }
    //Save new jobs
    if (todayJb) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: 'Microsoft',
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

    const message = `Today Microsoft has ${todayJb.length} positions. new jobs are:\n\n${normalizedJobs.join('\n\n')}`;
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