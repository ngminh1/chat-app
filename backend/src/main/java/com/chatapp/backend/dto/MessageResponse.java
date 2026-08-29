package com.chatapp.backend.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageResponse {
    private Long id;
    private Long conversationId;
    private Long senderId;
    private String senderName;
    private String content;
    private LocalDateTime createdAt;
}