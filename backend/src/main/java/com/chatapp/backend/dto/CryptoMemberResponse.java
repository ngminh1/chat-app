package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CryptoMemberResponse {
    private Long userId;
    private String publicKey;
    private Integer keyVersion;
    private boolean hasWrappedKey;
}
