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

  try {
    const payload = await verifier.verify(token);
    console.log("Token payload:", payload);

    const tableName = "nemesis-users";

    // Extract userId from pathParameters (or modify based on your API setup)
    const { userId } = event.pathParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "User ID is required" }),
      };
    }

    const getParams = {
      TableName: tableName,
      Key: {
        user_id: userId, // Replace 'user_id' with the actual Partition Key name of your table
      },
    };
    
    const { Item: user } = await dynamoDB.get(getParams).promise();
    

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ user }),
    };
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "TokenInvalidError"
    ) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired token" }) };
    }
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "An internal server error occurred" }) };
  }

  function getToken(event) {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Authorization header is missing or malformed");
    }
    return authHeader.split(" ")[1];
  }
}
