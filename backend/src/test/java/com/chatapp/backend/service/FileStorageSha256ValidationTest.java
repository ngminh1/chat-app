package com.chatapp.backend.service;

import com.chatapp.backend.security.sha256.SHA256;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.core.io.ByteArrayResource;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

import static org.junit.jupiter.api.Assertions.*;

class FileStorageSha256ValidationTest {
    @TempDir
    Path tempDir;

    private FileStorageService storage;

    @BeforeEach
    void setUp() {
        storage = new FileStorageService(tempDir);
    }

    private MockMultipartFile file(byte[] bytes) {
        return new MockMultipartFile("file", "test.txt", "text/plain", bytes);
    }

    @Test
    void missingFileReturnsNotFoundInsteadOfInternalServerError() {
        var missing = assertThrows(ResponseStatusException.class,
                () -> storage.loadFileAsResource("attachment-1-no-longer-exists.png"));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
    }

    @Test
    void traversalAttemptIsNotExposedAsServerError() {
        var missing = assertThrows(ResponseStatusException.class,
                () -> storage.loadFileAsResource("../private.txt"));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
    }

    @Test
    void r2UploadVerifiesDigestAndRemovesTemporaryFile() throws IOException {
        byte[] payload = "SHA256-R2".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        R2MediaStorage r2 = mock(R2MediaStorage.class);
        AtomicReference<byte[]> uploadedBytes = new AtomicReference<>();
        AtomicReference<Path> uploadedPath = new AtomicReference<>();
        doAnswer(invocation -> {
            Path path = invocation.getArgument(0);
            uploadedPath.set(path);
            uploadedBytes.set(Files.readAllBytes(path));
            return null;
        }).when(r2).upload(any(Path.class), anyString(), anyString());

        storage = new FileStorageService(tempDir, r2);
        String expected = SHA256.hashBytes(payload);
        var result = storage.storeFile(file(payload), false, 1L, expected);

        assertEquals(expected, result.getSha256());
        assertArrayEquals(payload, uploadedBytes.get());
        verify(r2).upload(any(Path.class), startsWith("attachment-1-"), eq("text/plain"));
        assertFalse(Files.exists(uploadedPath.get()));
        try (var saved = Files.list(tempDir)) {
            assertEquals(0, saved.count());
        }
    }

    @Test
    void r2IsNotCalledWhenDigestDoesNotMatch() {
        R2MediaStorage r2 = mock(R2MediaStorage.class);
        storage = new FileStorageService(tempDir, r2);
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
                () -> storage.storeFile(file(new byte[] {1}), false, 1L,
                        SHA256.hashBytes(new byte[] {2}))).getStatusCode());
        verifyNoInteractions(r2);
    }

    @Test
    void r2DownloadsPassThroughStorageService() {
        R2MediaStorage r2 = mock(R2MediaStorage.class);
        storage = new FileStorageService(tempDir, r2);
        String name = "attachment-1-present.png";
        var resource = new ByteArrayResource(new byte[] {1, 2, 3});
        when(r2.loadFileAsResource(name)).thenReturn(resource);
        assertSame(resource, storage.loadFileAsResource(name));
    }

    @Test
    void localFileCanBeReadDuringR2Migration() throws IOException {
        R2MediaStorage r2 = mock(R2MediaStorage.class);
        storage = new FileStorageService(tempDir, r2);
        String name = "attachment-1-legacy.png";
        byte[] oldContent = {7, 8, 9};
        Files.write(tempDir.resolve(name), oldContent);
        when(r2.loadFileAsResource(name)).thenThrow(
                new ResponseStatusException(HttpStatus.NOT_FOUND));

        try (var data = storage.loadFileAsResource(name).getInputStream()) {
            assertArrayEquals(oldContent, data.readAllBytes());
        }
    }

    @Test
    void validDigestIsReturnedWithUploadedFile() throws IOException {
        byte[] payload = "Dispatch SHA-256 upload".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String digest = SHA256.hashBytes(payload);

        var result = storage.storeFile(file(payload), false, 1L, digest);
        assertEquals(digest, result.getSha256());

        try (var saved = Files.list(tempDir)) {
            var paths = saved.toList();
            assertEquals(1, paths.size());
            assertArrayEquals(payload, Files.readAllBytes(paths.get(0)));
        }
    }

    @Test
    void changedDigestIsRejectedAndFileRemoved() throws IOException {
        byte[] payload = {1, 2, 3};
        String incorrectDigest = SHA256.hashBytes(new byte[] {1, 2, 4});

        var error = assertThrows(ResponseStatusException.class,
                () -> storage.storeFile(file(payload), false, 1L, incorrectDigest));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());

        try (var saved = Files.list(tempDir)) {
            assertEquals(0, saved.count());
        }
    }

    @Test
    void missingDigestForAttachmentIsRejected() {
        var error = assertThrows(ResponseStatusException.class,
                () -> storage.storeFile(file(new byte[] {1, 2, 3}), false, 1L, null));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void malformedDigestIsRejected() {
        var error = assertThrows(ResponseStatusException.class,
                () -> storage.storeFile(file(new byte[] {1, 2, 3}), false, 1L, "invalid"));
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

    @Test
    void avatarsRemainCompatibleWithoutExpectedDigest() {
        byte[] data = {1, 2, 3};
        var avatar = new MockMultipartFile("file", "avatar.png", "image/png", data);
        var result = storage.storeFile(avatar, true, null, null);
        assertEquals(SHA256.hashBytes(data), result.getSha256());
    }
}
