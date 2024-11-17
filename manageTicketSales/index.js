const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const mysql = require("mysql2/promise");

exports.handler = async (event) => {
  console.log(event.body);
  const { cardNumber, eventName, ticketsToBuy } = JSON.parse(event.body);
  const executionId = event.requestContext.requestId;

  const isValidCard =
    /^4[0-9]{12}(?:[0-9]{3})?$/.test(cardNumber) ||
    /^5[1-5][0-9]{14}$/.test(cardNumber);
  if (!isValidCard) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid credit card" }),
    };
  }

  try {
    await dynamodb
      .put({
        TableName: "LambdaExecutions",
        Item: { executionId },
        ConditionExpression: "attribute_not_exists(executionId)",
      })
      .promise();
  } catch (error) {
    if (error.code === "ConditionalCheckFailedException") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Duplicate execution" }),
      };
    }
    throw error;
  }

  const dbConnection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await dbConnection.execute(
      "SELECT tickets_available FROM events WHERE event_name = ?",
      [eventName]
    );
    if (rows.length === 0 || rows[0].tickets_available < ticketsToBuy) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Not enough tickets" }),
      };
    }

    await dbConnection.execute(
      "UPDATE events SET tickets_available = tickets_available - ? WHERE event_name = ?",
      [ticketsToBuy, eventName]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Purchase successful" }),
    };
  } catch (error) {
    console.error("Error managing tickets:", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
};
