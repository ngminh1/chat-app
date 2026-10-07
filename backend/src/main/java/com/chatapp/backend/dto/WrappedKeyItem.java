package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WrappedKeyItem {
    private Long userId;
    private String c1;
    private String c2;
    private Integer keyVersion;
}
