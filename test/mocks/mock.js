"use strict";

module.exports = class Mock {
    constructor() {
        this.calledMethods = {};
    }

    setMethodCalled(method, args, result) {
        const methodName = this._getMethodName(method);
        if (!this.calledMethods[methodName]) {
            this.calledMethods[methodName] = [];
        }

        this.calledMethods[methodName].push({ args, result });
    }

    getMethodCalledStatus(method) {
        const methodName = this._getMethodName(method);
        return this.calledMethods[methodName];
    }

    _getMethodName(method) {
        return `${this.constructor.name}.${method.name}`;
    }
};
