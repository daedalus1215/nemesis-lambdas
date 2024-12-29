import { CognitoJwtVerifier } from "aws-jwt-verify";
import AWS from "aws-sdk";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.CLIENT_ID,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

export async function handler(event) {
  console.log("Event:", event);
  const token = getToken(event);

  try {
    const payload = await verifier.verify(token);
    console.log("Token payload:", payload);

    const userId = payload.sub;

    const [senderResponse, receiverResponse] = await Promise.all([
      dynamoDB
        .query({
          TableName: 'nemesis-transactions',
          IndexName: 'SenderTransactionsIndex',
          KeyConditionExpression: "sender_id = :userId",
          ExpressionAttributeValues: {
            ":userId": userId,
          },
          ScanIndexForward: false,
        })
        .promise(),
      dynamoDB
        .query({
          TableName: 'nemesis-transactions',
          IndexName: 'ReceiverTransactionsIndex',
          KeyConditionExpression: "receiver_id = :userId",
          ExpressionAttributeValues: {
            ":userId": userId,
          },
          ScanIndexForward: false,
        })
        .promise(),
    ]);
    
    // Combine and sort transactions
    const allTransactions = [...senderResponse.Items, ...receiverResponse.Items];
    allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ transactions: allTransactions }),
    };



  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "TokenInvalidError") {
      return { statusCode: 401, body: "Invalid or expired token" };
    }

    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "An internal server error occurred", details: error.message }) };
  }
}

function getToken(event) {
  return event.headers.authorization.split(" ")[1];
}
