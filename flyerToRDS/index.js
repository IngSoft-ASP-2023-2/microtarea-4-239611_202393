const AWS = require("aws-sdk");
const mysql = require("mysql2/promise");

const s3 = new AWS.S3();

exports.handler = async (event) => {
  console.log("Lambda ", JSON.stringify(event));

  const bucketName = event.Records[0].s3.bucket.name;
  const flyerName = event.Records[0].s3.object.key;

  console.log(process.env.DB_HOST);
  console.log(process.env.DB_USER);
  console.log(process.env.DB_PASSWORD);
  console.log(process.env.DB_NAME);

  const dbConnection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log(bucketName);
  console.log(flyerName);

  try {
    const params = {
      Bucket: bucketName,
      Key: flyerName,
    };
    const data = await s3.getObject(params).promise();

    const base64Image = data.Body.toString("base64");

    const query = `
            UPDATE events
            SET flyer = ?
            WHERE event_name = ?
        `;
    await dbConnection.execute(query, [base64Image, flyerName]);

    console.log(
      `Updated event ${flyerName}`
    );
    return { statusCode: 200, body: "Flyer updated" };
  } catch (error) {
    console.error("Error ", error);
    throw error;
  } finally {
    await dbConnection.end();
  }
};
