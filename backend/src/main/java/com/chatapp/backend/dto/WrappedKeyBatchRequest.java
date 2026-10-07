package com.chatapp.backend.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WrappedKeyBatchRequest {
    private List<WrappedKeyItem> keys;
}
