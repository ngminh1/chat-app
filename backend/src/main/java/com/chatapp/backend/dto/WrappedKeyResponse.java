package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WrappedKeyResponse {
    private Long conversationId;
    private Long userId;
    private String c1;
    private String c2;
    private Integer keyVersion;
}
