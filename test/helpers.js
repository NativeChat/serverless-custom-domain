"use strict";

const assert = require("chai").assert;

const isMethodCalledAsync = async (service, methodName, action) => {
    const originalMethod = service.prototype[methodName];
    let called = false;
    service.prototype[methodName] = () => {
        called = true;
    };

    await action();
    service.prototype[methodName] = originalMethod;
    return called;
};

const assertMethodIsCalledAsync = async (service, methodName, action) => {
    const called = await isMethodCalledAsync(service, methodName, action);
    assert.isTrue(called);
};

const clone = (item) => {
    return JSON.parse(JSON.stringify(item));
};

module.exports = {
    assertMethodIsCalledAsync,
    clone,
    isMethodCalledAsync
};
