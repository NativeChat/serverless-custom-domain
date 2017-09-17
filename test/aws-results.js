"use strict";

const {
    ValidOptions,
    ValidDistributionDomainName,
    ValidDomainName,
    ValidCertificateDomainName,
    ValidCertificateSummary
} = require("./constants");

module.exports = {
    "ACM": {
        "listCertificates":
        {
            CertificateSummaryList: [ValidCertificateSummary]
        }
    },
    "APIGateway": {
        "getDomainNames": {
            items: [{
                domainName: `${ValidOptions.stage}-${ValidDomainName}`,
                distributionDomainName: ValidDistributionDomainName
            }]
        },
        "deleteDomainName": {}
    }
};
