"use strict";

const ServerlessMock = require("./serverless-mock");
const LoggerMock = require("./logger-mock");
const AwsServiceMock = require("./aws-service-mock");

module.exports.getServerlessMock = (customDomainConfig, region, awsResults) => {
    return new ServerlessMock(customDomainConfig, region, awsResults);
};

module.exports.getLoggerMock = () => {
    return new LoggerMock();
};

module.exports.getAwsServiceMock = () => {
    return new AwsServiceMock();
};
