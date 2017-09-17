"use strict";

const mocha = require("mocha");
const assert = require("chai").assert;

const ServerlessService = require("../../lib/services/serverless-service");
const mocks = require("../mocks");
const helpers = require("../helpers");
const { ValidDomainName } = require("../constants");

describe("ServerlessService", () => {
    describe("constructor", () => {
        it("should validate the plugin config.", async () => {
            await helpers.assertMethodIsCalledAsync(ServerlessService, "validateConfig", () => {
                new ServerlessService(mocks.getServerlessMock(), {});
            });
        });
        it("should add prefix to the domain name from the config.", async () => {
            await helpers.assertMethodIsCalledAsync(ServerlessService, "addPrefixToDomainName", () => {
                const slsMock = mocks.getServerlessMock();
                slsMock.service.custom.customDomainConfig = {
                    domainName: ValidDomainName
                };

                new ServerlessService(slsMock, {});
            });
        });
    });

    describe("validateConfig", () => {
        it("should NOT throw when the plugin config is valid.", () => {
            const slsMock = mocks.getServerlessMock();
            slsMock.service.custom.customDomainConfig = { domainName: ValidDomainName };

            assert.doesNotThrow(() => {
                new ServerlessService(slsMock, {});
            });
        });
        it("should throw when the plugin config is invalid.", () => {
            const slsMock = mocks.getServerlessMock();
            slsMock.service.custom.customDomainConfig = undefined;

            assert.throws(() => {
                new ServerlessService(slsMock, {});
            }, "Missing 'customDomainConfig' property in the 'custom' property of your serverless.yml.", "");

            slsMock.service.custom.customDomainConfig = {};
            assert.throws(() => {
                new ServerlessService(slsMock, {});
            }, "Missing 'domainName' in the plugin configuration.", "");

            slsMock.service.custom.customDomainConfig = { domainName: "" };
            assert.throws(() => {
                new ServerlessService(slsMock, {});
            }, "Missing 'domainName' in the plugin configuration.", "");

            slsMock.service.custom.customDomainConfig = { domainName: undefined };
            assert.throws(() => {
                new ServerlessService(slsMock, {});
            }, "Missing 'domainName' in the plugin configuration.", "");
        });
    });

    describe("addPrefixToDomainName", () => {
        it("should NOT add prefix for production stage.", () => {
            const config = {
                domainName: ValidDomainName,
                stage: "production"
            };

            const slsMock = mocks.getServerlessMock();
            slsMock.service.custom.customDomainConfig = config;

            const slsService = new ServerlessService(slsMock, {});

            assert.deepEqual(slsService.config.domainName, ValidDomainName);
        });
        it("should add the stage prefix for NON-production stage.", () => {
            const stage = "dev";
            const config = {
                domainName: ValidDomainName,
                stage: stage
            };

            const slsMock = mocks.getServerlessMock();
            slsMock.service.custom.customDomainConfig = config;

            const slsService = new ServerlessService(slsMock, {});

            assert.deepEqual(slsService.config.domainName, `${stage}-${ValidDomainName}`);
        });
    });
});
