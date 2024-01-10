import "https://deno.land/x/dotenv/load.ts";
import { S3Client } from "https://deno.land/x/s3_lite_client/mod.ts";

const S3_ENDPOINT = Deno.env.get("S3_ENDPOINT");
const S3_REGION = Deno.env.get("S3_REGION");
const S3_BUCKET = Deno.env.get("S3_BUCKET");
const S3_ACCESS_KEY_ID = Deno.env.get("S3_ACCESS_KEY_ID");
const SECRET_ACCESS_KEY = Deno.env.get("SECRET_ACCESS_KEY");

// Configure your S3 client here
const s3client = new S3Client({
  endPoint: S3_ENDPOINT,
  port: 443,
  useSSL: true,
  region: S3_REGION,
  accessKey: S3_ACCESS_KEY_ID,
  secretKey: SECRET_ACCESS_KEY,
  bucket: S3_BUCKET,
  pathStyle: true,
});

export async function uploadImage(buffer: Uint8Array, id: string) {
  const key = `${id}.jpg`;

  try {
    await s3client.putObject(key, buffer, {
      ContentType: "image/jpeg",
    });

    return {
      success: true,
      url: `https://${s3client.endPoint}/${s3client.bucket}/${key}`,
    };
  } catch (error) {
    return { success: false, reason: "Upload failed: " + error.message };
  }
}

export async function uploadResult(data: string, id: string) {
  const key = `${id}.json`;
  const dataString = JSON.stringify(data);

  try {
    await s3client.putObject(key, new TextEncoder().encode(dataString), {
      ContentType: "application/json; charset=utf-8",
    });

    return {
      success: true,
      url: `https://${S3_ENDPOINT}/${S3_BUCKET}/${key}`,
    };
  } catch (error) {

    console.log("Upload failed: ", error.message)

    return { success: false, reason: "Upload failed: " + error.message };
  }
}


export async function downloadResult(id: string) {
  const key = `${id}.json`;

  try {
    const response = await s3client.getObject(key);

    return response;

  } catch (error) {

    console.log("Upload failed: ", error.message)

    return;
  }
}