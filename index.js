"us strict";

const AwsService = require("./lib/services/aws-service");
const DomainNameService = require("./lib/services/domain-name-service");
const BasePathMappingService = require("./lib/services/base-path-mapping-service");
const RecordSetService = require("./lib/services/record-set-service");

class CustomDomainPlugin {
	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;

		this.commands = {
			"create-domain": {
				usage: "Creates custom domain name resource in API Gateway. This requires a certificate in Amazon Certificate Manager to be registered.",
				lifecycleEvents: [
					"create-domain"
				]
			},
			"remove-domain": {
				usage: "Removes the specified custom domain name resource from API Gateway.",
				lifecycleEvents: [
					"remove-domain"
				]
			},
			"create-record": {
				usage: "Creates a record set in the specified hosted zone with the cloud front addres from the specified domain name.",
				lifecycleEvents: [
					"create-record"
				]
			},
			"remove-record": {
				usage: "Removes the specified record set from the specified hosted zone.",
				lifecycleEvents: [
					"remove-record"
				]
			},
			"create-mapping": {
				usage: "Creates a base path mapping for the current API Gateway in the provided custom domain name.",
				lifecycleEvents: [
					"create-mapping"
				]
			},
			"remove-mapping": {
				usage: "Removes a base path mapping from the current API Gateway in the provided custom domain name.",
				lifecycleEvents: [
					"remove-mapping"
				]
			}
		};

		this.hooks = {
			"create-domain:create-domain": this.createDomain.bind(this),
			"remove-domain:remove-domain": this.removeDomain.bind(this),
			"create-record:create-record": this.createRecord.bind(this),
			"remove-record:remove-record": this.removeRecord.bind(this),
			"create-mapping:create-mapping": this.createMapping.bind(this),
			"remove-mapping:remove-mapping": this.removeMapping.bind(this)
		};
	}

	createDomain() {
		const awsService = new AwsService();
		const domainNameService = new DomainNameService(this.serverless,
			this.options,
			this.serverless.cli,
			awsService);
		return domainNameService.createApiNameAsync();
	}

	removeDomain() {
		const awsService = new AwsService();
		const domainNameService = new DomainNameService(this.serverless,
			this.options,
			this.serverless.cli,
			awsService);
		return domainNameService.removeApiNameAsync();
	}

	createRecord() {
		const awsService = new AwsService();
		const domainNameService = new DomainNameService(this.serverless,
			this.options,
			this.serverless.cli,
			awsService);
		const recordSetService = new RecordSetService(this.serverless,
			this.options,
			this.serverless.cli,
			domainNameService);
		return recordSetService.createRecordSetAsync();
	}

	removeRecord() {
		const awsService = new AwsService();
		const domainNameService = new DomainNameService(this.serverless,
			this.options,
			this.serverless.cli,
			awsService);
		const recordSetService = new RecordSetService(this.serverless, this.options, this.serverless.cli, domainNameService);
		return recordSetService.removeRecordSetAsync();
	}

	createMapping() {
		const basePathMappingService = new BasePathMappingService(this.serverless, this.options, this.serverless.cli);
		return basePathMappingService.createBasePathMappingAsync();
	}

	removeMapping() {
		const basePathMappingService = new BasePathMappingService(this.serverless, this.options, this.serverless.cli);
		return basePathMappingService.removeBasePathMappingAsync();
	}
}

module.exports = CustomDomainPlugin;
