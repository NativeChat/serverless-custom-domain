"use strict";

module.exports.getServerlessMock = () => {
    return {
        providers: {
            aws: {}
        },
        service: {
            custom: {
                customDomainConfig: {
                    stage: "",
                    domainName: ""
                }
            }
        },
        classes: {
            Error: Error
        }
    }
};
