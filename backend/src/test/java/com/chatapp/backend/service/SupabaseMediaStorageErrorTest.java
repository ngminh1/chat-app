package com.chatapp.backend.service;

import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class SupabaseMediaStorageErrorTest {
    private static boolean missing(int status, String body) {
        return SupabaseMediaStorage.isMissingObjectResponse(
                status, body == null ? null : body.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void missingObjectNewApiResponse() {
        assertTrue(missing(404, "{\"code\":\"NoSuchKey\",\"message\":\"Object not found\"}"));
    }

    @Test
    void missingObjectLegacyApiResponseWithHttp400() {
        assertTrue(missing(400, "{\"statusCode\":\"404\",\"error\":\"not_found\",\"message\":\"Object not found\"}"));
    }

    @Test
    void missingObjectLegacyMessageWithoutCode() {
        assertTrue(missing(400, "{\"statusCode\":\"404\",\"message\":\"Object not found\"}"));
    }

    @Test
    void forbiddenDoesNotPretendToBeMissing() {
        assertFalse(missing(403, "{\"code\":\"AccessDenied\"}"));
    }

    @Test
    void authenticationErrorDoesNotPretendToBeMissing() {
        assertFalse(missing(401, "{\"code\":\"InvalidJWT\"}"));
    }

    @Test
    void bucketConfigurationErrorsAreNotMissingObjects() {
        assertFalse(missing(400, "{\"code\":\"NoSuchBucket\",\"message\":\"Bucket not found\"}"));
    }

    @Test
    void unrelatedBadRequestIsNotMissing() {
        assertFalse(missing(400, "{\"code\":\"InvalidRequest\",\"message\":\"Invalid parameter\"}"));
    }

    @Test
    void normalResponseIsNotMissing() {
        assertFalse(missing(200, null));
    }
}
