"use strict";

const Mock = require("./mock");

module.exports = class AwsServiceMock extends Mock {
    constructor() {
        super();
    }

    getApiGatewayService() {
        const result = new ApiGatewayServiceMock();
        super.setMethodCalled(this.getApiGatewayService, arguments, result);
        return result;
    }
};

class ApiGatewayServiceMock extends Mock {
    constructor() {
        super();
    }

    createDomainName() {
        const result = { promise: () => Promise.resolve() };
        super.setMethodCalled(this.createDomainName, arguments, result);

        return result;
    }
}
