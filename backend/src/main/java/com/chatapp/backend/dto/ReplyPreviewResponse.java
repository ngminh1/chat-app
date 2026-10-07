package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReplyPreviewResponse {
    private Long messageId;
    private Long senderId;
    private String senderName;

    private String content;
    private String ciphertext;
    private String iv;
    private String encryptionVersion;
    private String sha256;
}
