"use strict";

const ServerlessService = require("./serverless-service");

class BasePathMappingService extends ServerlessService {
	constructor(serverless, options, logger) {
		super(serverless, options, logger);
	}

	async createBasePathMappingAsync() {
		const mappingInfo = await this._getMappingInfoAsync(this.config.basePath, this.config.domainName);
		if (!mappingInfo || !mappingInfo.restApiId) {
			this.logger.log(`Creating base path mapping ${this.config.basePath} for domain name ${this.config.domainName}...`);
			return this._createBasePathMappingAsync();
		}

		this.logger.log(`Base path mapping ${this.config.basePath} for domain name ${this.config.domainName} already exist. It will NOT be recreated.`);
		return true;
	}

	async removeBasePathMappingAsync() {
		const mappingInfo = await this._getMappingInfoAsync(this.config.basePath, this.config.domainName);
		if (!mappingInfo || !mappingInfo.restApiId) {
			this.logger.log(`Base path mapping ${this.config.basePath} for domain name ${this.config.domainName} does NOT exist.`);
			return true;
		}

		this.logger.log(`Removing base path mapping ${this.config.basePath} from domain name ${this.config.domainName}...`);
		return this._removeBasePathMappingAsync();
	}

	checkRequiredConfigProperties(config) {
		const errors = super.checkRequiredConfigProperties(config);

		if (config && !config.basePath) {
			errors.push("Missing 'basePath' in the plugin configuration.");
		}

		return errors;
	}

	async _getMappingInfoAsync(basePath, domainName) {
		const mappings = await this.provider.request("APIGateway", "getBasePathMappings", { domainName });
		if (!mappings || !mappings.items || !mappings.items.length) {
			return null;
		}

		return mappings.items.find(m => m.basePath === basePath);
	}

	async _createBasePathMappingAsync() {
		const apiInfo = await this._getRestApiInfoAsync(this.provider.naming.getApiGatewayName());
		return this.provider.request("APIGateway", "createBasePathMapping", {
			basePath: this.config.basePath,
			domainName: this.config.domainName,
			restApiId: apiInfo.id,
			stage: this.config.stage
		});

	}

	_removeBasePathMappingAsync() {
		return this.provider.request("APIGateway", "deleteBasePathMapping", {
			basePath: this.config.basePath,
			domainName: this.config.domainName
		});

	}

	async _getRestApiInfoAsync(apiName) {
		return this._getRestApiInfoAsyncCore(apiName, null);
	}

	async _getRestApiInfoAsyncCore(apiName, position) {
		const limit = 500;
		const getApisRequest = { limit };

		if (position) {
			getApisRequest.position = position;
		}

		const apis = await this.provider.request("APIGateway", "getRestApis", getApisRequest);
		const api = apis.items.find(a => a.name === apiName);

		if (api) {
			return api;
		} else if (apis.items.length === limit) {
			return await this._getRestApiInfoAsyncCore(apiName, apis.position);
		} else {
			return null;
		}
	}
}

module.exports = BasePathMappingService;
