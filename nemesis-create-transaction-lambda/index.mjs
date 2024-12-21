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
  console.log("token", token);

  try {
    const payload = await verifier.verify(token);
    console.log("Token payload:", payload);

    const body = JSON.parse(event.body);
    const { amount, receiverId } = body;

    if (!amount || !receiverId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing transaction details" }),
      };
    }

    const tableName = 'nemesis-users'; 
    const transactionTableName = 'nemesis-transactions'; 

    const sender = await dynamoDB
      .get({
        TableName: tableName,
        Key: { user_id: payload.sub },
      })
      .promise();

    if (!sender.Item) {
      return { statusCode: 404, body: JSON.stringify({ message: "Sender not found" }) };
    }

    const senderBalance = sender.Item.balance;
    if (senderBalance < amount) {
      return { statusCode: 400, body: JSON.stringify({ message: "Insufficient balance" }) };
    }

    const receiver = await dynamoDB
      .get({
        TableName: tableName,
        Key: { user_id: receiverId },
      })
      .promise();

    if (!receiver.Item) {
      return { statusCode: 404, body: JSON.stringify({ message: "Receiver not found" }) };
    }

    await dynamoDB.transactWrite({
      TransactItems: [
        {
          Update: {
            TableName: tableName,
            Key: { user_id: payload.sub },
            UpdateExpression: "SET balance = balance - :amount",
            ExpressionAttributeValues: {
              ":amount": amount,
            },
            ConditionExpression: "balance >= :amount",
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: { user_id: receiverId },
            UpdateExpression: "SET balance = balance + :amount",
            ExpressionAttributeValues: {
              ":amount": amount,
            },
          },
        },
        {
          Put: {
            TableName: transactionTableName,
            Item: {
              transaction_id: Date.now().toString(),
              sender_id: payload.sub,
              receiver_id: receiverId,
              amount: amount,
              timestamp: new Date().toISOString(),
            },
          },
        },
      ],
    }).promise();

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: "Transaction completed successfully",
        updatedSenderBalance: senderBalance - amount,
        updatedReceiverBalance: receiver.Item.balance + amount
      }) 
    };
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "TokenInvalidError") {
      return { statusCode: 401, body: "Invalid or expired token" };
    }

    console.error("Error:", error);
    if (error.code === 'TransactionCanceledException') {
      return { statusCode: 400, body: JSON.stringify({ message: "Transaction failed due to concurrent modification or insufficient balance" }) };
    }
    
    return { statusCode: 500, body: JSON.stringify({ error: "An internal server error occurred", details: error.message }) };
  }
}

function getToken(event) {
  return event.headers.authorization.split(" ")[1];
}