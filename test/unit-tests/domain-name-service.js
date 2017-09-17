"use strict";

const mocha = require("mocha");
const assert = require("chai").assert;

const ServerlessService = require("../../lib/services/serverless-service");
const DomainNameService = require("../../lib/services/domain-name-service");

const mocks = require("../mocks");
const helpers = require("../helpers");
const awsResults = require("../aws-results");
const {
    ValidDomainName,
    ValidDistributionDomainName,
    ValidCertificateArn,
    ValidCertificateDomainName,
    ValidCertificateSummary,
    ValidConfiguration,
    ValidOptions
    } = require("../constants");


describe("DomainNameService", () => {
    describe("constructor", () => {
        it("should validate the plugin config.", async () => {
            await helpers.assertMethodIsCalledAsync(ServerlessService, "validateConfig", () => {
                new DomainNameService(mocks.getServerlessMock(ValidConfiguration), {});
            });
        });
    });

    describe("validateConfig", () => {
        it("should NOT throw when the plugin config is valid.", () => {
            const slsMock = mocks.getServerlessMock(ValidConfiguration);

            assert.doesNotThrow(() => {
                new DomainNameService(slsMock, ValidOptions);
            });
        });
        it("should throw when the plugin config is invalid.", () => {
            const slsMock = mocks.getServerlessMock(ValidConfiguration);

            slsMock.service.custom.customDomainConfig.certificateDomainName = undefined;
            assert.throws(() => {
                new DomainNameService(slsMock, ValidOptions);
            }, "Missing 'certificateDomainName' in the plugin configuration.", "");

            slsMock.service.custom.customDomainConfig.certificateDomainName = "";
            assert.throws(() => {
                new DomainNameService(slsMock, ValidOptions);
            }, "Missing 'certificateDomainName' in the plugin configuration.", "");
        });
    });

    describe("domain name methods", () => {
        // Initialize for completion only.
        let service = new DomainNameService(mocks.getServerlessMock(ValidConfiguration), ValidOptions, {});
        let slsMock = mocks.getServerlessMock(ValidConfiguration, null, awsResults);
        let loggerMock = mocks.getLoggerMock();
        let awsService = mocks.getAwsServiceMock();

        beforeEach(() => {
            slsMock = mocks.getServerlessMock(ValidConfiguration, null, awsResults);
            loggerMock = mocks.getLoggerMock();
            awsService = mocks.getAwsServiceMock();

            service = new DomainNameService(slsMock, ValidOptions, loggerMock, awsService);
        });

        describe("createDomainNameAsync", () => {
            it("should create domain name if one does not exist.", async () => {
                service.getDomainNameInfoAsync = async () => null;
                await service.createDomainNameAsync();

                const requestCalledStatus = slsMock.providers.aws.getMethodCalledStatus(slsMock.providers.aws.request);
                assert.isArray(requestCalledStatus);
                assert.isNotEmpty(requestCalledStatus);
                const listCertsStatus = requestCalledStatus[0];
                assert.deepEqual(listCertsStatus.args[0], "ACM");
                assert.deepEqual(listCertsStatus.args[1], "listCertificates");
                assert.deepEqual(listCertsStatus.result, { CertificateSummaryList: [ValidCertificateSummary] });

                const getApiGatewayServiceStatus = awsService.getMethodCalledStatus(awsService.getApiGatewayService);
                assert.isArray(getApiGatewayServiceStatus);
                assert.isNotEmpty(getApiGatewayServiceStatus);

                const apiGatewayService = getApiGatewayServiceStatus[0].result;
                const createDomainNameStatus = apiGatewayService.getMethodCalledStatus(apiGatewayService.createDomainName);
                assert.isArray(createDomainNameStatus);
                assert.isNotEmpty(createDomainNameStatus);
                const expected = {
                    domainName: `${ValidOptions.stage}-${ValidDomainName}`,
                    certificateArn: ValidCertificateArn
                };
                assert.deepEqual(createDomainNameStatus[0].args[0], expected);
            });

            it("should NOT create domain name if one does exist.", async () => {
                service.getDomainNameInfoAsync = async () => ({});
                const called = await helpers.isMethodCalledAsync(DomainNameService, "_createDomainNameAsync", async () => {
                    await service.createDomainNameAsync();
                });

                assert.isFalse(called);
            });
        });

        describe("removeDomainNameAsync", () => {
            it("should delete the correct domain name.", async () => {
                await service.removeDomainNameAsync();

                const requestCalledStatus = slsMock.providers.aws.getMethodCalledStatus(slsMock.providers.aws.request);
                assert.isArray(requestCalledStatus);
                assert.isNotEmpty(requestCalledStatus);

                const argsGetDomainNames = requestCalledStatus[0].args;
                assert.deepEqual(argsGetDomainNames[0], "APIGateway");
                assert.deepEqual(argsGetDomainNames[1], "getDomainNames");

                const argsDeleteDomainName = requestCalledStatus[1].args;
                assert.deepEqual(argsDeleteDomainName[0], "APIGateway");
                assert.deepEqual(argsDeleteDomainName[1], "deleteDomainName");
                assert.deepEqual(argsDeleteDomainName[2], { domainName: `${ValidOptions.stage}-${ValidDomainName}` });
            });

            it("should not delete the domain name if there are no domain names.", async () => {
                slsMock.providers.aws._awsResults.APIGateway.getDomainNames = {
                    items: []
                };

                await service.removeDomainNameAsync();

                const requestCalledStatus = slsMock.providers.aws.getMethodCalledStatus(slsMock.providers.aws.request);
                assert.isArray(requestCalledStatus);
                assert.isNotEmpty(requestCalledStatus);

                const argsGetDomainNames = requestCalledStatus[0].args;
                assert.deepEqual(argsGetDomainNames[0], "APIGateway");
                assert.deepEqual(argsGetDomainNames[1], "getDomainNames");
                assert.equal(requestCalledStatus.length, 1);
            });

            it("should not delete the domain name if it does not exist.", async () => {
                slsMock.providers.aws._awsResults.APIGateway.getDomainNames = {
                    items: [{ domainName: "someotherdomain.bg" }]
                };

                await service.removeDomainNameAsync();

                const requestCalledStatus = slsMock.providers.aws.getMethodCalledStatus(slsMock.providers.aws.request);
                assert.isArray(requestCalledStatus);
                assert.isNotEmpty(requestCalledStatus);

                const argsGetDomainNames = requestCalledStatus[0].args;
                assert.deepEqual(argsGetDomainNames[0], "APIGateway");
                assert.deepEqual(argsGetDomainNames[1], "getDomainNames");

                assert.equal(requestCalledStatus.length, 1);
            });
        });

        describe("getDomainNameInfoAsync", () => {
            it("should get only the requested domain name info.", async () => {
                const expectedDomainNameInfo = {
                    domainName: ValidDomainName,
                    distributionDomainName: ValidDistributionDomainName
                };
                slsMock.providers.aws._awsResults.APIGateway.getDomainNames = {
                    items: [
                        { domainName: "wrongdomain.bg" },
                        expectedDomainNameInfo,
                        { domainName: "wrong2.bg" }
                    ]
                };

                const result = await service.getDomainNameInfoAsync(ValidDomainName);

                const requestCalledStatus = slsMock.providers.aws.getMethodCalledStatus(slsMock.providers.aws.request);
                assert.isArray(requestCalledStatus);
                assert.isNotEmpty(requestCalledStatus);

                const argsGetDomainNames = requestCalledStatus[0].args;
                assert.deepEqual(argsGetDomainNames[0], "APIGateway");
                assert.deepEqual(argsGetDomainNames[1], "getDomainNames");

                assert.deepEqual(result, expectedDomainNameInfo);
            });

            it("should return null if there is no result.", async () => {
                slsMock.providers.aws._awsResults.APIGateway.getDomainNames = null;

                const result = await service.getDomainNameInfoAsync(ValidDomainName);

                const requestCalledStatus = slsMock.providers.aws.getMethodCalledStatus(slsMock.providers.aws.request);
                assert.isArray(requestCalledStatus);
                assert.isNotEmpty(requestCalledStatus);

                const argsGetDomainNames = requestCalledStatus[0].args;
                assert.deepEqual(argsGetDomainNames[0], "APIGateway");
                assert.deepEqual(argsGetDomainNames[1], "getDomainNames");

                assert.equal(result, null);
            });

            it("should return undefined if the requested domain name is not found.", async () => {
                slsMock.providers.aws._awsResults.APIGateway.getDomainNames = {
                    items: [
                        { domainName: "wrongdomain.bg" },
                        { domainName: "wrong2.bg" },
                        { domainName: "wrong3.bg" }
                    ]
                };

                const result = await service.getDomainNameInfoAsync(ValidDomainName);

                const requestCalledStatus = slsMock.providers.aws.getMethodCalledStatus(slsMock.providers.aws.request);
                assert.isArray(requestCalledStatus);
                assert.isNotEmpty(requestCalledStatus);

                const argsGetDomainNames = requestCalledStatus[0].args;
                assert.deepEqual(argsGetDomainNames[0], "APIGateway");
                assert.deepEqual(argsGetDomainNames[1], "getDomainNames");

                assert.equal(result, undefined);
            });
        });
    });
});
