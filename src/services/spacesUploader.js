const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs/promises");
const spacesConfig = require("../config/spaces");

const s3Client = new S3Client({
  endpoint: spacesConfig.endpoint,
  region: spacesConfig.region,
  credentials: spacesConfig.credentials,
  forcePathStyle: false,
});

async function uploadToSpaces(filePath, filename, mimetype) {
  const fileBuffer = await fs.readFile(filePath);

  const command = new PutObjectCommand({
    Bucket: spacesConfig.bucket,
    Key: filename,
    Body: fileBuffer,
    ACL: "public-read",
    ContentType: mimetype,
  });

  await s3Client.send(command);

  const publicUrl = `${spacesConfig.endpoint.replace("https://", `https://${spacesConfig.bucket}.`)}/${filename}`;
  return publicUrl;
}

module.exports = { uploadToSpaces };
