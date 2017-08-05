"use strict";

module.exports.clone = (item) => {
    return JSON.parse(JSON.stringify(item));
};

module.exports.isMethodCalled = (service, methodName, action) => {
    const originalMethod = service[methodName];
    let isMethodCalled = false;
    service[methodName] = () => {
        isMethodCalled = true;
    };

    action();
    service[methodName] = originalMethod;
    return isMethodCalled;
};
