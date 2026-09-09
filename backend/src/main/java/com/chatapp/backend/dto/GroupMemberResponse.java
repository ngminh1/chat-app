package com.chatapp.backend.dto;

import com.chatapp.backend.entity.MemberRole;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMemberResponse {
    private Long userId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private MemberRole role;
    private LocalDateTime joinedAt;
}