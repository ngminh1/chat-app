package com.chatapp.backend.service;

import com.chatapp.backend.dto.FileUploadResponse;
import com.chatapp.backend.entity.MessageType;
import com.chatapp.backend.security.MediaUrls;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException; // <--- Thêm import này vào
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.Objects;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path fileStorageLocation;

    public FileStorageService() {
        this.fileStorageLocation = Paths.get("uploads").toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("Không thể tạo thư mục lưu trữ file uploads", ex);
        }
    }

    public FileUploadResponse storeFile(MultipartFile file, boolean avatar, Long conversationId) {
        String originalFileName = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));

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
            Path targetLocation = this.fileStorageLocation.resolve(uniqueFileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            String contentType = file.getContentType();
            MessageType messageType = MessageType.FILE;
            if (contentType != null && contentType.startsWith("image/")) {
                messageType = MessageType.IMAGE;
            }

            String fileDownloadUri = MediaUrls.FILES + uniqueFileName;

            return FileUploadResponse.builder()
                    .fileUrl(fileDownloadUri)
                    .fileName(originalFileName)
                    .fileSize(file.getSize())
                    .messageType(messageType)
                    .build();

        } catch (IOException ex) {
            throw new RuntimeException("Không thể lưu file " + originalFileName, ex);
        }
    }

    public Resource loadFileAsResource(String fileName) {
        try {
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();
            if (!filePath.startsWith(this.fileStorageLocation) || !Files.isRegularFile(filePath)) {
                throw new RuntimeException("Không tìm thấy tệp tin: " + fileName);
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            } else {
                throw new RuntimeException("Không tìm thấy tệp tin: " + fileName);
            }
        } catch (MalformedURLException ex) {
            throw new RuntimeException("Không tìm thấy tệp tin: " + fileName, ex);
        }
    }
}
