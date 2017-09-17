"use strict";

const Mock = require("./mock");

module.exports = class LoggerMock extends Mock {
    constructor() {
        super();
    }

    log() {
        const result = undefined;
        super.setMethodCalled(this.log, arguments, result);
        return result;
    }
};
