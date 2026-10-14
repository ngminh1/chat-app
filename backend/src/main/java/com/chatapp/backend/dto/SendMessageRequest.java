package com.chatapp.backend.dto;

import com.chatapp.backend.entity.MessageType;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendMessageRequest {
    private Long conversationId;
    private Long senderId;

    // Legacy / SYSTEM / IMAGE / FILE content.
    private String content;

    // TEXT AES fields.
    private String ciphertext;
    private String iv;
    private String encryptionVersion;

    private Long replyToId;
    private MessageType messageType;
    private String mediaUrl;
    private String fileName;
    private Long fileSize;
}
