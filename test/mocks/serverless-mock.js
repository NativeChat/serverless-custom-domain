"use strict";

const Mock = require("./mock");
const { clone } = require("../helpers");

const defaultCustomDomainConfig = {
    stage: "test",
    domainName: "domain.bg"
};

module.exports = class ServerlessMock extends Mock {
    constructor(customDomainConfig, region, awsResults) {
        super();
        this.providers = {
            aws: new AwsProviderMock(region, awsResults)
        };

        this.service = {
            custom: {
                customDomainConfig: customDomainConfig ? clone(customDomainConfig) : defaultCustomDomainConfig
            }
        };

        this.classes = {
            Error: Error
        };
    }
};

class AwsProviderMock extends Mock {
    constructor(region, awsResults) {
        super();
        this._region = region;
        this._awsResults = awsResults || {};
    }

    getCredentials() {
        const result = {};
        this.setMethodCalled(this.getCredentials, arguments, result);
        return result;
    }

    getRegion() {
        const result = this._region || "eu-west-1";
        this.setMethodCalled(this.getRegion, arguments, result);
        return result
    }

    async request(serviceName, method, data) {
        const awsService = this._awsResults[serviceName];
        if (!awsService) {
            const err = new Error("invalid aws service used");
            this.setMethodCalled(this.request, arguments, err);
            throw err;
        }

        const result = awsService[method];
        if (result === undefined) {
            const err = new Error("invalid aws method called");
            this.setMethodCalled(this.request, arguments, err);
            throw err;
        }

        this.setMethodCalled(this.request, arguments, result);
        return result;
    }
}
