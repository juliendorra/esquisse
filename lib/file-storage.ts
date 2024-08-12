import "https://deno.land/x/dotenv/load.ts";
import { S3Client } from "https://deno.land/x/s3_lite_client/mod.ts";

const S3_ENDPOINT = Deno.env.get("S3_ENDPOINT") || "";
const S3_REGION = Deno.env.get("S3_REGION") || "";
const S3_BUCKET = Deno.env.get("S3_BUCKET");
const S3_ACCESS_KEY_ID = Deno.env.get("S3_ACCESS_KEY_ID");
const SECRET_ACCESS_KEY = Deno.env.get("SECRET_ACCESS_KEY");

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
  const key = `${id}.jpeg`;

  const hashSafeB64Pattern = /^[A-Za-z0-9\-_]{42,44}$/;
  const isHash = hashSafeB64Pattern.test(id);

  if (isHash) {
    const imageExists = await s3client.exists(key);
    console.log("[IMAGE UPLOAD] image exists, checked by hash")

    if (imageExists) {
      return {
        success: true,
        url: `https://${S3_ENDPOINT}/${S3_BUCKET}/${key}`,
      };
    }
  };

  try {
    console.log("[IMAGE UPLOAD] putting image in store")

    const response = await s3client.putObject(
      key,
      buffer,
      {
        metadata: {
          "Content-Type": "image/jpeg",
        }
      });

    console.log(`[IMAGE UPLOAD] response `, JSON.stringify(response))

    return {
      success: true,
      url: `https://${S3_ENDPOINT}/${S3_BUCKET}/${key}`,
    };
  } catch (error) {
    return { success: false, reason: "Upload failed: " + error.message };
  }
}

export async function uploadResult(data: string, id: string) {
  const key = `${id}.json`;
  const dataString = JSON.stringify(data);

  try {
    await s3client.putObject(
      key,
      new TextEncoder().encode(dataString),
      {
        metadata: {
          "Content-Type": "application/json; charset=utf-8",
        }
      });

    return {
      success: true,
      url: `https://${S3_ENDPOINT}/${S3_BUCKET}/${key}`,
    };
  } catch (error) {
    console.log("Upload failed: ", error.message);
    return { success: false, reason: "Upload failed: " + error.message };
  }
}


export async function downloadImage(id: string) {
  const key = `${id}.jpeg`;

  try {
    const response = await s3client.getObject(key);

    return response;

  } catch (error) {
    console.log("Download failed: ", error.message);
    return;
  }
}

export async function downloadResult(id: string) {
  const key = `${id}.json`;

  try {
    const response = await s3client.getObject(key);

    return response;
  } catch (error) {
    console.log("Download failed: ", error.message);
    return;
  }
}

export async function uploadAppVersion(data: string, appid: string, versionhash: string) {

  const key = `${appid}-${versionhash}.json`;

  try {
    await s3client.putObject(
      key, new TextEncoder().encode(data),
      {
        metadata: {
          "Content-Type": "application/json; charset=utf-8",
        }
      });

    return {
      success: true,
      url: `https://${S3_ENDPOINT}/${S3_BUCKET}/${key}`,
    };
  } catch (error) {
    console.log("[APP VERSION FILE] Upload failed: ", error.message);
    return { success: false, reason: "Upload failed: " + error.message };
  }
}

export async function downloadAppVersion(appid: string, versionhash: string) {

  const key = `${appid}-${versionhash}.json`;

  try {
    const response = await s3client.getObject(key);
    return response ? new TextDecoder().decode(await response.arrayBuffer()) : null;
  } catch (error) {
    console.log("[APP VERSION FILE] Download failed: ", error.message);
    return;
  }
}
