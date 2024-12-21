import { CognitoJwtVerifier } from "aws-jwt-verify";
import AWS from "aws-sdk";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.CLIENT_ID,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

export async function handler(event) {
  const token = getToken(event);
  console.log("token", token);

  try {
    const payload = await verifier.verify(token);

    console.log("Token payload:", payload);

    const tableName = "nemesis-users";

    const scanParams = {
      TableName: tableName
    };
    
    const { Items: users } = await dynamoDB.scan(scanParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ users }),
    };
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "TokenInvalidError"
    ) {
      return { statusCode: 401, body: "Invalid or expired token" };
    }
    console.error("Error:", error);
    return { statusCode: 500, body: "An internal server error occurred" };
  }

  function getToken(event) {
    return event.headers.authorization.split(" ")[1];
  }
}
