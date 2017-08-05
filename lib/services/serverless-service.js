"use strict";

const EOL = require("os").EOL;

class ServerlessService {
	constructor(serverless, options, logger) {
		this.serverless = serverless;
		this.options = options;
		this.logger = logger;
		this.provider = this.serverless.providers.aws;
		this.config = this.serverless.service.custom.customDomainConfig;

		this.validateConfig(this.config);

		this.config.stage = this.config.stage || this.options.stage || "dev";
		this.config.domainName = this.addPrefixToDomainName(this.config.domainName);
	}

	validateConfig(config) {
		const validationErrors = this.checkRequiredConfigProperties(config);

		if (validationErrors.length) {
			throw new this.serverless.classes.Error(validationErrors.join(EOL));
		}
	}

	checkRequiredConfigProperties(config) {
		const errors = [];

		if (!config) {
			errors.push("Missing 'customDomainConfig' property in the 'custom' property of your serverless.yml");
		}

		if (config && !config.domainName) {
			errors.push("Missing 'domainName' in the plugin configuration.");
		}

		return errors;
	}

	addPrefixToDomainName(domain) {
		const domainPrefix = this.config.stage === "production" ? "" : this.config.stage + "-";
		if (domain.startsWith(domainPrefix)) {
			return domain;
		} else {
			return `${domainPrefix}${domain}`;
		}
	}
}

module.exports = ServerlessService;
