"use strict";

const { ApiGwVersions } = require("../constants");
const ServerlessService = require("./serverless-service");

class BasePathMappingService extends ServerlessService {
	constructor(serverless, options, logger) {
		super(serverless, options, logger);
	}

	async createBasePathMappingAsync() {
		const mappingExists = await this._mappingExistsAsync(this.config.basePath, this.config.customDomainName);
		if (!mappingExists) {
			this.logger.log(`Creating base path mapping ${this.config.basePath} for domain name ${this.config.customDomainName}...`);
			return this._createMappingAsync();
		}

		this.logger.log(`Base path mapping ${this.config.basePath} for domain name ${this.config.customDomainName} already exist. It will NOT be recreated.`);
		return true;
	}

	async removeBasePathMappingAsync() {
		const mappingExists = await this._mappingExistsAsync(this.config.basePath, this.config.customDomainName);
		if (!mappingExists) {
			this.logger.log(`Base path mapping ${this.config.basePath} for domain name ${this.config.customDomainName} does NOT exist.`);
			return true;
		}

		this.logger.log(`Removing base path mapping ${this.config.basePath} from domain name ${this.config.customDomainName}...`);
		return this._removeMappingAsync(this.config.customDomainName, this.config.basePath);
	}

	checkRequiredConfigProperties(config) {
		const errors = super.checkRequiredConfigProperties(config);

		if (config && !config.basePath) {
			errors.push("Missing 'basePath' in the plugin configuration.");
		}

		return errors;
	}

	async _mappingExistsAsync(basePath, domainName) {
		const mappings = await this.provider.request("APIGateway", "getBasePathMappings", { domainName });
		if (!mappings || !mappings.items || !mappings.items.length) {
			return false;
		}

		if (mappings.items.find(m => m.basePath === basePath)) {
			return true;
		}

		const mapping = await this._getMappingInfoV2Async(domainName, basePath);

		return !!mapping;
	}

	async _createMappingAsync() {
		const apiName = this.provider.naming.getApiGatewayName();
		const apiId = await this._getApiIdAsync(apiName);
		if (!apiId) {
			throw new this.serverless.classes.Error(`Can't find API with name: ${apiName}`);
		}

		if (this.config.apiGwVersion === ApiGwVersions.V2) {
			return this.provider.request("ApiGatewayV2", "createApiMapping", {
				ApiMappingKey: this.config.basePath,
				DomainName: this.config.customDomainName,
				ApiId: apiId,
				Stage: this.config.stage
			});
		}

		return this.provider.request("APIGateway", "createBasePathMapping", {
			basePath: this.config.basePath,
			domainName: this.config.customDomainName,
			restApiId: apiId,
			stage: this.config.stage
		});
	}

	async _removeMappingAsync(domainName, basePath) {
		const apiName = this.provider.naming.getApiGatewayName();
		const apiId = await this._getApiIdAsync(apiName);
		const mapping = await this._getMappingInfoV2Async(domainName, basePath);
		if (mapping) {
			return this.provider.request("ApiGatewayV2", "deleteApiMapping", {
				ApiId: apiId,
				ApiMappingId: mapping.ApiMappingId,
				DomainName: domainName
			});
		}

		return this.provider.request("APIGateway", "deleteBasePathMapping", {
			basePath: basePath,
			domainName: domainName
		});
	}

	async _getApiIdAsync(apiName) {
		let apiId = null;
		if (this.config.apiGwVersion === ApiGwVersions.V2) {
			const api = await this._getApiIdV2Async(apiName);
			if (api) {
				apiId = api.ApiId || api.ApiGatewayDomainName;
			}
		} else {
			const api = await this._getApiIdV1Async(apiName);
			if (api) {
				apiId = api.id;
			}
		}

		return apiId;
	}

	async _getApiIdV2Async(apiName, nextToken) {
		const getApisRequest = { MaxResults: "500" };

		if (nextToken) {
			getApisRequest.NextToken = nextToken;
		}

		const apis = await this.provider.request("ApiGatewayV2", "getApis", getApisRequest);
		const api = apis.Items.find(a => a.Name === apiName);

		if (api) {
			return api;
		} else if (apis.Items.length === limit) {
			return await this._getApiIdV2Async(apiName, apis.NextToken);
		} else {
			return null;
		}
	}

	async _getApiIdV1Async(apiName, position) {
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
			return await this._getApiIdV1Async(apiName, apis.position);
		} else {
			return null;
		}
	}

	async _getMappingInfoV2Async(domainName, basePath) {
		const mappings = await this.provider.request("ApiGatewayV2", "getApiMappings", { DomainName: domainName });
		if (!mappings || !mappings.Items || !mappings.Items.length) {
			return null;
		}

		return mappings.Items.find(m => m.ApiMappingKey === basePath);
	}
}

module.exports = BasePathMappingService;
