package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EditMessageRequest {
    private Long messageId;
    private Long senderId;

    // Legacy edit
    private String content;

    // AES edit
    private String ciphertext;
    private String iv;
    private String encryptionVersion;
    private String sha256;
}
