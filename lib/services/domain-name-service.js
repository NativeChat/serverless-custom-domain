"use strict";

const ServerlessService = require("./serverless-service");

class DomainNameService extends ServerlessService {
	constructor(serverless, options, logger, awsService) {
		super(serverless, options, logger);
		this._originalRegion = this.provider.getRegion();
	}

	async createApiNameAsync() {
		const domainName = this.config.domainName;
		const domainInfo = await this.getDomainNameInfoAsync(domainName);
		if (!domainInfo) {
			this.logger.log(`Creating custom domain name - ${domainName}...`);
			return this._createDomainNameAsync(domainName);
		}

		this.logger.log(`Custom domain name ${domainName} already exists. It will NOT be recreated.`);
		return true;
	}

	async removeApiNameAsync() {
		const domainName = this.config.domainName;
		const domainInfo = await this.getDomainNameInfoAsync(domainName);
		if (domainInfo) {
			this.logger.log(`Removing custom domain name ${domainName}...`);
			return this.provider.request("APIGateway", "deleteDomainName", { domainName });
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

	async getDomainNameInfoAsync(domainName) {
		const domains = await this.provider.request("APIGateway", "getDomainNames");
		if (!domains || !domains.items) {
			return null;
		}

		return domains.items.find(d => d.domainName === domainName);
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

		const certificates = await this.provider.request("ACM", "listCertificates");
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
		const certificateArn = await this._getCertificateArnAsync(this.config.certificateDomainName)
		// TODO: Uncomment when serverless updates it's aws-sdk.
		// return this._provider.request("APIGateway", "createDomainName", { domainName, certificateArn });

		const credentials = this.provider.getCredentials();
		const service = awsService.getApiGatewayService(credentials);

		return service.createDomainName({ domainName, certificateArn }).promise();
	}
}

module.exports = DomainNameService;
