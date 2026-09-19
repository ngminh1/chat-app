package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AesKeyResponse {
    private Long conversationId;
    private String key;
}
