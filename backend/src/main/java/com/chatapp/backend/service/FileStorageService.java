package com.chatapp.backend.service;

import com.chatapp.backend.dto.FileUploadResponse;
import com.chatapp.backend.entity.MessageType;
import com.chatapp.backend.security.MediaUrls;
import com.chatapp.backend.security.sha256.SHA256;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException; // <--- Thêm import này vào
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.Objects;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.util.UUID;

@Service
public class FileStorageService {
    private static final long MAX_UPLOAD_BYTES = 25L * 1024 * 1024;

    private final Path fileStorageLocation;
    private final R2MediaStorage r2Storage;

    @Autowired
    public FileStorageService(ObjectProvider<R2MediaStorage> r2StorageProvider) {
        this(Paths.get("uploads"), r2StorageProvider.getIfAvailable());
    }

    FileStorageService(Path storageDirectory) {
        this(storageDirectory, null);
    }

    FileStorageService(Path storageDirectory, R2MediaStorage r2Storage) {
        this.r2Storage = r2Storage;
        this.fileStorageLocation = storageDirectory.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("Không thể tạo thư mục lưu trữ file uploads", ex);
        }
    }

    public FileUploadResponse storeFile(MultipartFile file, boolean avatar, Long conversationId, String expectedSha256) {
        String originalFileName = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
        if (file.isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Tệp rỗng");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE, "Tệp vượt giới hạn 25 MB");
        }
        if (!avatar && (expectedSha256 == null || !expectedSha256.matches("(?i)[0-9a-f]{64}"))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Thiếu SHA-256 hợp lệ");
        }

        try {
            if (originalFileName.contains("..")) {
                throw new RuntimeException("Tên file không hợp lệ: " + originalFileName);
            }

            if (avatar) {
                String type = file.getContentType();
                String lowerName = originalFileName.toLowerCase(java.util.Locale.ROOT);
                if (type == null || !type.startsWith("image/") ||
                        !(lowerName.endsWith(".png") || lowerName.endsWith(".jpg") ||
                          lowerName.endsWith(".jpeg") || lowerName.endsWith(".gif") ||
                          lowerName.endsWith(".webp"))) {
                    throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.BAD_REQUEST, "Avatar phải là ảnh PNG, JPEG, GIF hoặc WebP");
                }
            }

            String fileExtension = "";
            int dotIndex = originalFileName.lastIndexOf('.');
            if (dotIndex > 0) {
                fileExtension = originalFileName.substring(dotIndex);
            }

            String uniqueFileName = (avatar ? "avatar-" : "attachment-" + conversationId + "-")
                    + UUID.randomUUID() + fileExtension;
            // With R2, the local copy is only a temporary buffer for SHA-256 validation.
            // It is removed even when hashing or R2 upload fails.
            Path targetLocation = r2Storage == null
                    ? this.fileStorageLocation.resolve(uniqueFileName)
                    : Files.createTempFile("dispatch-upload-", ".tmp");
            try {
                Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            String actualSha256;
            try (InputStream savedFile = Files.newInputStream(targetLocation)) {
                actualSha256 = SHA256.hashStream(savedFile);
            }
            if (!avatar) {
                if (!expectedSha256.matches("(?i)[0-9a-f]{64}") ||
                        !MessageDigest.isEqual(
                                actualSha256.getBytes(StandardCharsets.US_ASCII),
                                expectedSha256.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.US_ASCII))) {
                    Files.deleteIfExists(targetLocation);
                    throw new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.BAD_REQUEST,
                            "SHA-256 khong khop: tep tai len bi thay doi");
                }
            }

            String contentType = file.getContentType();
            if (r2Storage != null) {
                r2Storage.upload(targetLocation, uniqueFileName, contentType);
            }
            MessageType messageType = MessageType.FILE;
            if (contentType != null && contentType.startsWith("image/")) {
                messageType = MessageType.IMAGE;
            }

            String fileDownloadUri = MediaUrls.FILES + uniqueFileName;

            return FileUploadResponse.builder()
                    .fileUrl(fileDownloadUri)
                    .fileName(originalFileName)
                    .fileSize(file.getSize())
                    .sha256(actualSha256)
                    .messageType(messageType)
                    .build();
            } finally {
                if (r2Storage != null) {
                    Files.deleteIfExists(targetLocation);
                }
            }
        } catch (IOException ex) {
            throw new RuntimeException("Không thể lưu file " + originalFileName, ex);
        }
    }

    public Resource loadFileAsResource(String fileName) {
        if (r2Storage != null) {
            try {
                return r2Storage.loadFileAsResource(fileName);
            } catch (org.springframework.web.server.ResponseStatusException e) {
                // Allow previously stored local files to remain accessible during migration.
                // If R2 is temporarily unavailable, do NOT treat it as a missing file.
                if (e.getStatusCode() != org.springframework.http.HttpStatus.NOT_FOUND) {
                    throw e;
                }
            }
        }
        try {
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();
            if (!filePath.startsWith(this.fileStorageLocation) || !Files.isRegularFile(filePath)) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Tệp không còn tồn tại trên máy chủ");
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            } else {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Tệp không còn tồn tại trên máy chủ");
            }
        } catch (MalformedURLException ex) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Đường dẫn tệp không hợp lệ", ex);
        }
    }
}
