"use strict";

const { ApiGwVersions } = require("../constants");
const ServerlessService = require("./serverless-service");

class DomainNameService extends ServerlessService {
	constructor(serverless, options, logger) {
		super(serverless, options, logger);
		this._originalRegion = this.provider.getRegion();
	}

	async createApiNameAsync() {
		const domainName = this.config.domainName;
		const domainNameExists = await this.domainNameExistsAsync(domainName);
		if (!domainNameExists) {
			this.logger.log(`Creating custom domain name - ${domainName}...`);
			return this._createDomainNameAsync(domainName);
		}

		this.logger.log(`Custom domain name ${domainName} already exists. It will NOT be recreated.`);
		return true;
	}

	async removeApiNameAsync() {
		const domainName = this.config.domainName;
		const domainNameExists = await this.domainNameExistsAsync(domainName);
		if (domainNameExists) {
			this.logger.log(`Removing custom domain name ${domainName}...`);
			if (this.config.apiGwVersion === ApiGwVersions.V2) {
				return this.provider.request("ApiGatewayV2", "deleteDomainName", { DomainName: domainName });
			} else {
				return this.provider.request("APIGateway", "deleteDomainName", { domainName });
			}
		}

		this.logger.log(`Skipping remove custom domain name. ${domainName} does not exist.`);
		return true;
	}

	checkRequiredConfigProperties(config) {
		const errors = super.checkRequiredConfigProperties(config);

		if (config && !config.certificateDomainName) {
			errors.push("Missing 'certificateDomainName' in the plugin configuration.");
		}

		return errors;
	}

	async domainNameExistsAsync(domainName) {
		const domain = await this._getDomainNameInfoAsync(domainName);

		return !!domain;
	}

	async getDistributionDomainName(domainName) {
		const domain = await this._getDomainNameInfoAsync(domainName);
		if (!domain) {
			return null;
		}

		return domain.distributionDomainName || domain.regionalDomainName || (domain.DomainNameConfigurations && domain.DomainNameConfigurations[0].ApiGatewayDomainName);
	}

	async getTargetHostedZoneId(domainName) {
		const domain = await this._getDomainNameInfoAsync(domainName);
		if (!domain) {
			return null;
		}

		/**
		 * For CloudFront distribution use this HostedZoneId Z2FDTNDATAQYW2.
		 * http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Route53.html#changeResourceRecordSets-property
		 */
		const cloudFrontDistributionHostedZoneId = "Z2FDTNDATAQYW2";
		return domain.distributionHostedZoneId || domain.regionalHostedZoneId || (domain.DomainNameConfigurations && domain.DomainNameConfigurations[0].HostedZoneId) || cloudFrontDistributionHostedZoneId;
	}

	async _getDomainNameInfoAsync(domainName) {
		let domains = await this.provider.request("APIGateway", "getDomainNames", {});
		if (!domains || !domains.items) {
			return null;
		}

		const domain = domains.items.find(d => d.domainName === domainName);
		if (domain) {
			return domain;
		}


		domains = await this.provider.request("ApiGatewayV2", "getDomainNames", {});
		if (!domains || !domains.Items) {
			return null;
		}

		return domains.Items.find(d => d.DomainName === domainName);
	}

	async _getCertificateArnAsync(domainName) {
		/*
		 We need to set the region of the provider to eu-east-1
		 because the certificates required for custom domains in API Gateway
		 can be imported only in eu-east-1 for now.
		 http://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html
		*/
		const region = "us-east-1";
		this.options.region = region;

		const certificates = await this.provider.request("ACM", "listCertificates", {});
		this.options.region = this._originalRegion;
		if (!certificates || !certificates.CertificateSummaryList || !certificates.CertificateSummaryList.length) {
			return null;
		}

		const certificate = certificates.CertificateSummaryList.find(c => c.DomainName === domainName);

		if (!certificate) {
			return null;
		}

		return certificate.CertificateArn;
	}

	async _createDomainNameAsync(domainName) {
		const certificateArn = await this._getCertificateArnAsync(this.config.certificateDomainName);
		if (this.config.apiGwVersion === ApiGwVersions.V2) {
			return this._provider.request("ApiGatewayV2", "createDomainName", { DomainName: domainName, CertificateArn: certificateArn }).promise();
		}

		return this._provider.request("APIGateway", "createDomainName", { domainName, certificateArn });
	}
}

module.exports = DomainNameService;
