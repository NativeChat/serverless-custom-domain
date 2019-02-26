"use strict";

const childProcess = require("child_process");
const AWS = require("aws-sdk");

const ServerlessService = require("./serverless-service");

class RecordSetService extends ServerlessService {
	constructor(serverless, options, logger, domainNameService) {
		super(serverless, options, logger);
		this.domainNameService = domainNameService;
		this.config.canary = this.options.canary;
		this._route53Service = null;
	}

	async createRecordSetAsync() {
		await this._changeRecordSetAsync("CREATE", async (record, hostedZoneId) => {
			if (await this._checkIfRecordExistsAsync(record, hostedZoneId)) {
				this.logger.log(`Record for ${record.AliasTarget.DNSName} with name ${this.config.domainName} and weight ${record.Weight} exists. It will NOT be created again.`);
				return false;
			} else {
				return true;
			}
		});
	}

	async removeRecordSetAsync() {
		return this._changeRecordSetAsync("DELETE", async (record, hostedZoneId) => {
			if (await this._checkIfRecordExistsAsync(record, hostedZoneId)) {
				return true;
			} else {
				this.logger.log(`Record for ${record.AliasTarget.DNSName} with name ${this.config.domainName} and weight ${record.Weight} does NOT exist. There is nothing to remove.`);
				return false;
			}
		});
	}

	async _changeRecordSetAsync(action, shouldExecuteChangeAction) {
		const domainName = this.config.domainName;
		const domainExists = await this.domainNameService.domainNameExistsAsync(domainName);
		if (!domainExists) {
			throw new Error(`Custom domain name ${domainName} does NOT exist.`);
		}

		const hostedZoneName = this.config.hostedZoneName;
		const hostedZoneInfo = await this._getHostedZoneInfoAsync(hostedZoneName);
		if (!hostedZoneInfo) {
			throw new Error(`Hosted zone ${hostedZoneName} which is ${this.config.isPrivateHostedZone ? "" : "not"} private does NOT exist.`);
		}

		const hostedZoneId = this._getHostedZoneId(hostedZoneInfo);
		const distributionDomainName = await this.domainNameService.getDistributionDomainName(domainName);
		const targetHostedZoneId = await this.domainNameService.getTargetHostedZoneId(domainName);
		const params = this._createRecordInfo(hostedZoneId, distributionDomainName, targetHostedZoneId, action);
		let result = null;
		if (await shouldExecuteChangeAction.apply(this, [params.ChangeBatch.Changes[0].ResourceRecordSet, hostedZoneId])) {
			const route53 = await this._getRoute53ClientAsync();
			result = route53.changeResourceRecordSets(params).promise();
		}

		return result;
	}

	async _checkIfRecordExistsAsync(record, hostedZoneId) {
		const route53 = await this._getRoute53ClientAsync();
		const records = await route53.listResourceRecordSets({ HostedZoneId: hostedZoneId }).promise();
		return !!records.ResourceRecordSets.find(r => {
			return r.Name === record.Name + "." &&
				r.Weight === record.Weight &&
				r.SetIdentifier === record.SetIdentifier &&
				r.AliasTarget.DNSName === record.AliasTarget.DNSName + ".";
		});
	}

	async _getCredentialsFromRoleAsync() {
		if (!this.config.route53Role) {
			return null;
		}

		const assumeRoleParams = {
			RoleArn: this.config.route53Role,
			RoleSessionName: "serverless-user"
		};

		const assumeRoleResult = await this.provider.request("STS", "assumeRole", assumeRoleParams);

		return assumeRoleResult.Credentials;
	}

	async _getHostedZoneInfoAsync(hostedZoneName) {
		const route53 = await this._getRoute53ClientAsync();
		const zones = await route53.listHostedZones({}).promise();
		if (!zones || !zones.HostedZones || !zones.HostedZones.length) {
			return null;
		}

		return zones.HostedZones.find(zone => zone.Name === hostedZoneName && zone.Config.PrivateZone === !!this.config.isPrivateHostedZone);
	}

	_createRecordInfo(hostedZoneId, distributionDomainName, targetHostedZoneId, action) {
		const weight = this.config.canary ? 10 : 100;
		const domainName = this.config.canary ? this.config.canaryDomain : this.config.domainName;

		this.logger.log(`${action} record set for ${distributionDomainName} with name ${domainName} and weight ${weight}...`);

		return {
			ChangeBatch: {
				Changes: [{
					Action: action,
					ResourceRecordSet: {
						AliasTarget: {
							DNSName: distributionDomainName,
							EvaluateTargetHealth: false,
							HostedZoneId: targetHostedZoneId
						},
						Name: domainName,
						Type: "A",
						Weight: weight,
						SetIdentifier: `${domainName}${this.config.canary ? "-canary" : ""}`
					}
				}],
				Comment: `${this.config.canary ? "Canary " : ""}${domainName} record set.`
			},
			HostedZoneId: hostedZoneId
		};
	}

	_getHostedZoneId(hostedZoneInfo) {
		const idRegExp = /\/hostedzone\/(.*)/;

		const matches = hostedZoneInfo.Id.match(idRegExp);

		if (!matches || !matches[1]) {
			throw new Error("Invalid hosted zone id.");
		}

		return matches[1];
	}

	async _getRoute53ClientAsync() {
		if (!this._route53Service) {
			const credentials = await this._getCredentialsFromRoleAsync();
			const config = { credentials: {} };
			if (credentials) {
				config.credentials = { accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretAccessKey, sessionToken: credentials.SessionToken };
			} else {
				const credentialsChain = new this.provider.sdk.CredentialProviderChain();
				config.credentials = await credentialsChain.resolvePromise();
			}

			this._route53Service = new this.provider.sdk.Route53(config);
		}

		return this._route53Service;
	}
}

module.exports = RecordSetService;
