package com.chatapp.backend.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PresenceResponse {
    private Long userId;
    private Boolean isOnline;
    private LocalDateTime lastSeenAt;
}