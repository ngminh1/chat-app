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
    private String content;
    private Long replyToId;
    private MessageType messageType;
    private String mediaUrl;
    private String fileName;
    private Long fileSize;
}