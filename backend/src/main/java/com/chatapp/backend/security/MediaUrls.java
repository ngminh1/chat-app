package com.chatapp.backend.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class MediaUrls {
    public static final String FILES = "/api/media/files/";

    private MediaUrls() {}

    public static String attachmentPrefix(Long conversationId) {
        return FILES + "attachment-" + conversationId + "-";
    }

    public static void requirePublicAvatarUrl(String url) {
        if (url == null || url.isBlank()) return;
        if (url.startsWith("/uploads/") ||
                (url.contains(FILES) && !url.substring(url.indexOf(FILES) + FILES.length()).startsWith("avatar-"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar phải là file avatar đã tải lên");
        }
    }
}
