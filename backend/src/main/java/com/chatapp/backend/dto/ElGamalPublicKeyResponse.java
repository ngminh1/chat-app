package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElGamalPublicKeyResponse {
    private Long userId;
    private String publicKey;
    private Integer keyVersion;
}
