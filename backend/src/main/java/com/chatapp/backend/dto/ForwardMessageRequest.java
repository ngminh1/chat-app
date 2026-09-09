package com.chatapp.backend.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForwardMessageRequest {
    private Long messageId;
    private Long senderId;
    private List<Long> targetConversationIds;
}