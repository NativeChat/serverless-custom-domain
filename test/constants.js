"use strict";

const ValidDomainName = "domain.bg";
const ValidCertificateDomainName = `*.${ValidDomainName}`;
const ValidDistributionDomainName = "https://cu1uaoqdke.execute-api.us-west-2.amazonaws.com";
const ValidCertificateArn = "arm:aws:route53:::certName";
const ValidConfiguration = {
    domainName: ValidDomainName,
    certificateDomainName: ValidCertificateDomainName
};

const ValidOptions = {
    stage: "test",
    env: "test"
};

const ValidCertificateSummary = {
    DomainName: ValidCertificateDomainName,
    CertificateArn: ValidCertificateArn
};

module.exports = {
    ValidCertificateArn,
    ValidCertificateDomainName,
    ValidCertificateSummary,
    ValidConfiguration,
    ValidDistributionDomainName,
    ValidDomainName,
    ValidOptions
};
