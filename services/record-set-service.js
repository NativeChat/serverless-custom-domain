"use strict";

const childProcess = require("child_process");
const AWS = require("aws-sdk");

const ServerlessService = require("./serverless-service");
let originalProfile;
let originalAccessKeyId;
let originalSecretAccessKey;
let originalSessonToken;

class RecordSetService extends ServerlessService {
	constructor(serverless, options, logger, domainNameService) {
		super(serverless, options, logger);
		this.domainNameService = domainNameService;
		this.config.canary = this.options.canary;
		this.config.canaryDomain = super.addPrefixToDomainName(this.options.canaryDomain);
		this._saveOriginalProfile();
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
		const domainInfo = await this.domainNameService.getDomainNameInfoAsync(domainName);
		if (!domainInfo) {
			throw new Error(`Custom domain name ${domainName} does NOT exist.`);
		}

		const credentials = await this._getCredentialsFromRoleAsync();
		if (credentials) {
			await this._overrideProfile(credentials.AccessKeyId, credentials.SecretAccessKey, credentials.SessionToken);
		}

		const hostedZoneName = this.config.hostedZoneName;
		const hostedZoneInfo = await this._getHostedZoneInfoAsync(hostedZoneName);
		if (!hostedZoneInfo) {
			throw new Error(`Hosted zone ${hostedZoneName} which is ${this.config.isPrivateHostedZone ? "" : "not"} private does NOT exist.`);
		}

		const hostedZoneId = this._getHostedZoneId(hostedZoneInfo);

		const params = this._createRecordInfo(hostedZoneId, domainInfo.distributionDomainName, action);
		let result = null;
		if (await shouldExecuteChangeAction.apply(this, [params.ChangeBatch.Changes[0].ResourceRecordSet, hostedZoneId])) {
			result = this.provider.request("Route53", "changeResourceRecordSets", params);
		}

		if (credentials) {
			this._restoreOriginalProfile();
		}

		return result;
	}

	async _checkIfRecordExistsAsync(record, hostedZoneId) {
		const records = await this.provider.request("Route53", "listResourceRecordSets", { HostedZoneId: hostedZoneId });
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

	_getHostedZoneInfoAsync(hostedZoneName) {
		return this.provider.request("Route53", "listHostedZones")
			.then(zones => {
				if (!zones || !zones.HostedZones || !zones.HostedZones.length) {
					return null;
				}

				return zones.HostedZones.find(zone => zone.Name === hostedZoneName && zone.Config.PrivateZone === !!this.config.isPrivateHostedZone);
			});
	}

	_saveOriginalProfile() {
		originalProfile = process.env.AWS_PROFILE;
		originalAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
		originalSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
		originalSessonToken = process.env.AWS_SESSION_TOKEN;
	}

	_overrideProfile(accessKeyId, secretAccessKey, sessionToken) {
		process.env.AWS_PROFILE = null;
		process.env.AWS_ACCESS_KEY_ID = accessKeyId || originalAccessKeyId;
		process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey || originalSecretAccessKey;
		process.env.AWS_SESSION_TOKEN = sessionToken || originalSecretAccessKey;

	}

	_restoreOriginalProfile() {
		process.env.AWS_PROFILE = originalProfile;
		process.env.AWS_ACCESS_KEY_ID = originalAccessKeyId;
		process.env.AWS_SECRET_ACCESS_KEY = originalSecretAccessKey;
		process.env.AWS_SESSION_TOKEN = originalSessonToken;
	}

	_createRecordInfo(hostedZoneId, distributionDomainName, action) {
		/**
		 * For CloudFront distribution use this HostedZoneId Z2FDTNDATAQYW2.
		 * http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Route53.html#changeResourceRecordSets-property
		 */
		const cloudFrontDistributionHostedZoneId = "Z2FDTNDATAQYW2";
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
							HostedZoneId: cloudFrontDistributionHostedZoneId
						},
						Name: domainName,
						Type: "A",
						Weight: weight,
						SetIdentifier: `${domainName}${this.config.cnary ? "(Canary)" : ""}`
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

	_setEnvVariable(variable, value) {
		childProcess.execSync(`export ${variable}=${value}`);
	}
}

module.exports = RecordSetService;
