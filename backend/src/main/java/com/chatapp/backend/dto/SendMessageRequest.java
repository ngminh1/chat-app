package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageRequest {
    private Long conversationId;
    private Long senderId;
    private String content;
}