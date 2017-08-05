"use strict";

const AWS = require("aws-sdk");

class AwsService {
    getApiGatewayService(credentials) {
        return new AWS.APIGateway(credentials);
    }
}
