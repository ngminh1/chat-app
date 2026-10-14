package com.chatapp.backend.service;

import jakarta.annotation.PreDestroy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Path;

/**
 * Private Cloudflare R2 bucket. Only the application's authenticated media
 * controller may serve objects; the browser never receives R2 credentials.
 */
@Component
@ConditionalOnProperty(name = "app.media.storage", havingValue = "r2")
public class R2MediaStorage {
    private static final String KEY_PREFIX = "dispatch/";

    private final S3Client client;
    private final String bucket;

    public R2MediaStorage(
            @Value("${R2_ACCOUNT_ID:}") String accountId,
            @Value("${R2_BUCKET:}") String bucket,
            @Value("${R2_ACCESS_KEY_ID:}") String accessKeyId,
            @Value("${R2_SECRET_ACCESS_KEY:}") String secretAccessKey) {
        if (accountId.isBlank() || bucket.isBlank()
                || accessKeyId.isBlank() || secretAccessKey.isBlank()) {
            throw new IllegalStateException(
                    "R2 storage enabled but R2_ACCOUNT_ID, R2_BUCKET or credentials are missing");
        }
        if (!accountId.matches("[a-fA-F0-9]{32}")) {
            throw new IllegalStateException("R2_ACCOUNT_ID is not a valid Cloudflare account ID");
        }

        this.bucket = bucket;
        this.client = S3Client.builder()
                .endpointOverride(URI.create("https://" + accountId + ".r2.cloudflarestorage.com"))
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        // Cloudflare R2 rejects default Java SDK streaming chunk signatures.
                        .chunkedEncodingEnabled(false)
                        .build())
                .build();
    }

    public void upload(Path file, String fileName, String contentType) {
        requireSafeFileName(fileName);
        try {
            client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(KEY_PREFIX + fileName)
                            .contentType(contentType == null ? "application/octet-stream" : contentType)
                            .build(),
                    RequestBody.fromFile(file));
        } catch (S3Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Không thể lưu tệp lên R2", e);
        }
    }

    public Resource loadFileAsResource(String fileName) {
        requireSafeFileName(fileName);
        try {
            var response = client.getObject(GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(KEY_PREFIX + fileName)
                    .build());
            long length = response.response().contentLength();
            // InputStreamResource must not consume its stream when Spring queries the size.
            return new InputStreamResource((InputStream) response) {
                @Override
                public String getFilename() {
                    return fileName;
                }

                @Override
                public long contentLength() {
                    return length;
                }
            };
        } catch (NoSuchKeyException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp trên R2");
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp trên R2");
            }
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Không thể tải tệp từ R2", e);
        }
    }

    private static void requireSafeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()
                || fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Đường dẫn tệp không hợp lệ");
        }
    }

    @PreDestroy
    public void close() {
        client.close();
    }
}
