package com.chatapp.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TypingRequest {
    private Long conversationId;
    private Long userId;
    private String userName;

    @JsonProperty("isTyping")
    private Boolean isTyping;
}