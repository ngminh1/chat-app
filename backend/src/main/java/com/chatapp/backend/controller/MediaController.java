package com.chatapp.backend.controller;

import com.chatapp.backend.dto.FileUploadResponse;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.ConversationRepository;
import com.chatapp.backend.repository.MessageRepository;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.MediaUrls;
import com.chatapp.backend.security.RequestAccess;
import com.chatapp.backend.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ContentDisposition;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final FileStorageService fileStorageService;
    private final RequestAccess access;
    private final ConversationMemberRepository members;
    private final MessageRepository messages;
    private final UserRepository users;
    private final ConversationRepository conversations;

    @PostMapping("/upload")
    public ResponseEntity<FileUploadResponse> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam String purpose,
            @RequestParam(required = false) Long conversationId) {
        boolean avatar;
        if ("avatar".equals(purpose)) {
            avatar = true;
        } else if ("attachment".equals(purpose) && conversationId != null) {
            access.requireMember(conversationId);
            avatar = false;
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu loại upload hoặc hội thoại");
        }
        FileUploadResponse response = fileStorageService.storeFile(file, avatar, conversationId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/files/{fileName:.+}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String fileName) {
        return downloadFileForUrls(fileName, List.of(MediaUrls.FILES + fileName));
    }

    public ResponseEntity<Resource> downloadLegacyFile(String fileName) {
        return downloadFileForUrls(fileName, List.of(
                "/uploads/" + fileName,
                "http://localhost:8080/uploads/" + fileName));
    }

    private ResponseEntity<Resource> downloadFileForUrls(String fileName, List<String> urls) {
        boolean publicAvatar = fileName.startsWith("avatar-");
        if (!publicAvatar) {
            publicAvatar = urls.stream().anyMatch(url ->
                    users.existsByAvatarUrl(url) || conversations.existsByAvatarUrl(url));
            if (!publicAvatar) {
                Long userId = access.currentUserId();
                boolean allowed = urls.stream()
                        .flatMap(url -> messages.findByMediaUrlAndIsDeletedFalse(url).stream())
                        .anyMatch(message -> members.findByConversationIdAndUserId(
                                message.getConversation().getId(), userId).isPresent());
                if (!allowed) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền tải tệp");
            }
        }
        Resource resource = fileStorageService.loadFileAsResource(fileName);

        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(fileName).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        (publicAvatar ? ContentDisposition.inline() : ContentDisposition.attachment())
                                .filename(resource.getFilename()).build().toString())
                .body(resource);
    }
}
