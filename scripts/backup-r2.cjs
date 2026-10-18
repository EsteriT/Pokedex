const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { account, bucket, prefix } = require("./backup-automation.cjs");
function connect(env) {
  const client = new S3Client({
    region: "auto",
    endpoint: "https://" + account + ".r2.cloudflarestorage.com",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return storeFor(client);
}
function storeFor(client) {
  const send = (Command, input) => {
    if (
      (input.Key && !input.Key.startsWith(prefix)) ||
      (input.Prefix && input.Prefix !== prefix)
    )
      throw Error("Refused R2 operation outside the managed backup prefix.");
    return client.send(new Command({ Bucket: bucket, ...input }), {
      abortSignal: AbortSignal.timeout(60000),
    });
  };
  return {
    put: (Key, Body) =>
      send(PutObjectCommand, {
        Key,
        Body,
        ContentType: "application/octet-stream",
        CacheControl: "no-store",
        StorageClass: "STANDARD",
        IfNoneMatch: "*",
      }),
    async get(Key, limit) {
      const response = await send(GetObjectCommand, { Key });
      try {
        if (response.ContentLength !== limit)
          throw Error("R2 download size mismatch.");
        const chunks = [];
        let size = 0;
        for await (const chunk of response.Body) {
          size += chunk.length;
          if (size > limit)
            throw Error("R2 download exceeds the expected size.");
          chunks.push(chunk);
        }
        if (size !== limit) throw Error("R2 download size mismatch.");
        return Buffer.concat(chunks);
      } finally {
        response.Body?.destroy();
      }
    },
    async list(Prefix, ContinuationToken) {
      const page = await send(ListObjectsV2Command, {
        Prefix,
        ContinuationToken,
        MaxKeys: 1000,
      });
      if (page.IsTruncated && !page.NextContinuationToken)
        throw Error("Missing R2 listing cursor.");
      return {
        objects: (page.Contents || []).map((o) => ({
          key: o.Key,
          modified: o.LastModified,
        })),
        cursor: page.IsTruncated ? page.NextContinuationToken : undefined,
      };
    },
    remove: (Key) => send(DeleteObjectCommand, { Key }),
    async exists(Key) {
      try {
        await send(HeadObjectCommand, { Key });
        return true;
      } catch (error) {
        if (error.$metadata?.httpStatusCode === 404) return false;
        throw error;
      }
    },
    close: () => client.destroy(),
  };
}
module.exports = { connect, storeFor };
