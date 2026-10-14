package com.chatapp.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;

/** Private object storage, reached only through Dispatch's authenticated media API. */
@Component
@ConditionalOnProperty(name = "app.media.storage", havingValue = "supabase")
public class SupabaseMediaStorage {
    private static final String KEY_PREFIX = "dispatch/";
    private final HttpClient client;
    private final String baseUrl;
    private final String bucket;
    private final String secretKey;

    public SupabaseMediaStorage(
            @Value("${SUPABASE_URL:}") String projectUrl,
            @Value("${SUPABASE_BUCKET:}") String bucket,
            @Value("${SUPABASE_SECRET_KEY:}") String secretKey) {
        if (projectUrl.isBlank() || bucket.isBlank() || secretKey.isBlank()) {
            throw new IllegalStateException("Missing SUPABASE_URL, SUPABASE_BUCKET or SUPABASE_SECRET_KEY");
        }
        URI uri = URI.create(projectUrl.strip());
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null
                || !uri.getHost().endsWith(".supabase.co") || uri.getUserInfo() != null
                || (uri.getPath() != null && !uri.getPath().isBlank() && !"/".equals(uri.getPath()))
                || uri.getQuery() != null || uri.getFragment() != null
                || !bucket.matches("[a-zA-Z0-9_-]+")) {
            throw new IllegalStateException("Invalid Supabase project URL or bucket");
        }
        if (!secretKey.startsWith("sb_secret_") && !secretKey.startsWith("eyJ")) {
            throw new IllegalStateException("Use the Supabase server secret key, not an anon/public key");
        }
        this.baseUrl = "https://" + uri.getHost();
        this.bucket = bucket;
        this.secretKey = secretKey;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(12))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public void upload(Path validatedFile, String fileName, String contentType) {
        requireSafeName(fileName);
        try {
            HttpRequest request = authenticatedRequest(fileName)
                    .header("Content-Type", contentType == null || contentType.isBlank()
                            ? "application/octet-stream" : contentType)
                    .timeout(Duration.ofSeconds(120))
                    .POST(HttpRequest.BodyPublishers.ofFile(validatedFile))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Supabase rejected upload (HTTP " + response.statusCode() + ")");
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Supabase upload unavailable", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Upload interrupted", e);
        }
    }

    public Resource loadFileAsResource(String fileName) {
        requireSafeName(fileName);
        try {
            HttpResponse<byte[]> response = client.send(
                    authenticatedRequest(fileName, true).timeout(Duration.ofSeconds(90)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Media not present on Supabase");
            }
            if (response.statusCode() != 200) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Supabase media request failed (HTTP " + response.statusCode() + ")");
            }
            byte[] bytes = response.body();
            return new ByteArrayResource(bytes) {
                @Override public String getFilename() { return fileName; }
            };
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Supabase download unavailable", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Download interrupted", e);
        }
    }

    private HttpRequest.Builder authenticatedRequest(String fileName) {
        return authenticatedRequest(fileName, false);
    }

    private HttpRequest.Builder authenticatedRequest(String fileName, boolean download) {
        String resource = baseUrl + "/storage/v1/object/"
                + (download ? "authenticated/" : "") + bucket + "/" + KEY_PREFIX + fileName;
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(resource))
                .header("apikey", secretKey);
        // Legacy service_role key is a JWT. The new sb_secret_ key is not a JWT.
        if (!secretKey.startsWith("sb_secret_")) {
            request.header("Authorization", "Bearer " + secretKey);
        }
        return request;
    }

    private static void requireSafeName(String fileName) {
        if (fileName == null || !fileName.matches("[a-zA-Z0-9_.-]+") || fileName.contains("..")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid media name");
        }
    }
}
