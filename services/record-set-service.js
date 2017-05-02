"use strict";

const childProcess = require("child_process");
const AWS = require("aws-sdk");

const ServerlessService = require("./serverless-service");
let originalProfile;

class RecordSetService extends ServerlessService {
	constructor(serverless, options, logger, domainNameService) {
		super(serverless, options, logger);
		this.domainNameService = domainNameService;
		this.config.isLimited = this.options.limited;
		this._saveOriginalProfile();
	}

	async createRecordSetAsync() {
		await this._changeRecordSetAsync("CREATE");
	}

	async removeRecordSetAsync() {
		return this._changeRecordSetAsync("DELETE");
	}

	async _changeRecordSetAsync(action) {
		const domainName = this.config.domainName;
		const domainInfo = await this.domainNameService.getDomainNameInfoAsync(domainName);
		if (!domainInfo) {
			throw new Error(`Custom domain name ${domainName} does NOT exist.`);
		}

		this._overrideProfile();
		const hostedZoneName = this.config.hostedZoneName;
		const hostedZoneInfo = await this._getHostedZoneInfoAsync(hostedZoneName);
		if (!hostedZoneInfo) {
			throw new Error(`Hosted zone ${hostedZoneName} which is ${this.config.isPrivateHostedZone ? "" : "not"} private does NOT exist.`);
		}

		const hostedZoneId = this._getHostedZoneId(hostedZoneInfo);

		const params = this._createRecordInfo(hostedZoneId, domainInfo.distributionDomainName, action);
		// const result = await this.provider.request("Route53", "listResourceRecordSets", {HostedZoneId: hostedZoneId});
		const result = this.provider.request("Route53", "changeResourceRecordSets", params);

		this._restoreOriginalProfile();
		return result;
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
	}

	_overrideProfile() {
		process.env.AWS_PROFILE = this.config.awsRoute53Profile || originalProfile;
	}

	_restoreOriginalProfile() {
		process.env.AWS_PROFILE = originalProfile;
	}

	_createRecordInfo(hostedZoneId, distributionDomainName, action) {
		/**
		 * For CloudFront distribution use this HostedZoneId Z2FDTNDATAQYW2.
		 * http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Route53.html#changeResourceRecordSets-property
		 */
		const cloudFrontDistributionHostedZoneId = "Z2FDTNDATAQYW2";
		const weight = this.config.isLimited ? 10 : 100;

		this.logger.log(`${action} record set for ${distributionDomainName} with name ${this.config.domainName} and weight ${weight}...`);
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
						Name: this.config.domainName,
						Type: "A",
						Weight: weight,
						SetIdentifier: `${this.config.domainName}${this.config.isLimited ? "(Limited)" : ""}`
					}
				}],
				Comment: `${this.config.isLimited ? "Limited " : ""}${this.config.domainName} record set.`
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
