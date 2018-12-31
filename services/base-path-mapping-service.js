"use strict";

const AWS = require("aws-sdk");

const ServerlessService = require("./serverless-service");

class BasePathMappingService extends ServerlessService {
	constructor(serverless, options, logger) {
		super(serverless, options, logger);
	}

	async createBasePathMappingAsync() {
		const mappingInfo = await this._getMappingInfoAsync(this.config.basePath, this.config.customDomainName);
		if (!mappingInfo || !mappingInfo.restApiId) {
			this.logger.log(`Creating base path mapping ${this.config.basePath} for domain name ${this.config.customDomainName}...`);
			return this._createBasePathMappingAsync();
		}

		this.logger.log(`Base path mapping ${this.config.basePath} for domain name ${this.config.customDomainName} already exist. It will NOT be recreated.`);
		return true;
	}

	async removeBasePathMappingAsync() {
		const mappingInfo = await this._getMappingInfoAsync(this.config.basePath, this.config.customDomainName);
		if (!mappingInfo || !mappingInfo.restApiId) {
			this.logger.log(`Base path mapping ${this.config.basePath} for domain name ${this.config.customDomainName} does NOT exist.`);
			return true;
		}

		this.logger.log(`Removing base path mapping ${this.config.basePath} from domain name ${this.config.customDomainName}...`);
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
		const apiName = this.provider.naming.getApiGatewayName();
		const apiInfo = await this._getApiInfoAsync(apiName);
		if (!apiInfo) {
			throw this.serverless.classes.Error(`Can't find API with name: ${apiName}`);
		}

		return this.provider.request("APIGateway", "createBasePathMapping", {
			basePath: this.config.basePath,
			domainName: this.config.customDomainName,
			restApiId: apiInfo.id || apiInfo.ApiId,
			stage: this.config.stage
		});

	}

	_removeBasePathMappingAsync() {
		return this.provider.request("APIGateway", "deleteBasePathMapping", {
			basePath: this.config.basePath,
			domainName: this.config.customDomainName
		});

	}

	async _getApiInfoAsync(apiName) {
		let result = await this._getRestApiInfoAsyncCore(apiName, null);
		if (!result) {
			result = await this._getWebsocketApiInfoAsyncCore(apiName, null);
		}

		return result;
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

	async _getWebsocketApiInfoAsyncCore(apiName, nextToken) {
		const maxResults = "500";
		const getApisRequest = { MaxResults: maxResults };

		if (nextToken) {
			getApisRequest.NextToken = nextToken;
		}

		const service = new AWS.ApiGatewayV2(this.provider.getCredentials())
		const apis = await service.getApis(getApisRequest).promise();
		const api = apis.Items.find(a => a.Name === apiName);

		if (api) {
			return api;
		} else if (apis.NextToken) {
			return await this._getRestApiInfoAsyncCore(apiName, apis.NextToken);
		} else {
			return null;
		}
	}
}

module.exports = BasePathMappingService;
