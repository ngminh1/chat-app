package com.chatapp.backend.dto;

import com.chatapp.backend.entity.FriendshipStatus;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FriendshipResponse {
    private Long id;
    private UserResponse user;
    private FriendshipStatus status;
    private LocalDateTime createdAt;
}