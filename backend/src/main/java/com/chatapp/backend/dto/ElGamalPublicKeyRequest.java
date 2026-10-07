package com.chatapp.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ElGamalPublicKeyRequest {
    private String publicKey;
    private Integer keyVersion;
}
