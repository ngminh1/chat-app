package com.chatapp.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class FileStorageSha256ValidationTest {
    private final FileStorageService storage = new FileStorageService();

    @Test
    void missingDigestForAttachmentIsRejected() {
        var file = new MockMultipartFile("file", "test.txt", "text/plain", new byte[] {1, 2, 3});
        var error = assertThrows(ResponseStatusException.class,
                () -> storage.storeFile(file, false, 1L, null));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void malformedDigestIsRejected() {
        var file = new MockMultipartFile("file", "test.txt", "text/plain", new byte[] {1, 2, 3});
        var error = assertThrows(ResponseStatusException.class,
                () -> storage.storeFile(file, false, 1L, "invalid"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void oversizedFileIsRejected() {
        byte[] bytes = new byte[25 * 1024 * 1024 + 1];
        var file = new MockMultipartFile("file", "large.bin", "application/octet-stream", bytes);
        var error = assertThrows(ResponseStatusException.class,
                () -> storage.storeFile(file, false, 1L, "a".repeat(64)));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, error.getStatusCode());
    }
}
