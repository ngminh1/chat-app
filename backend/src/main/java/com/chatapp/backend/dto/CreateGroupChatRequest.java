package com.chatapp.backend.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateGroupChatRequest {
    private String title;
    private String avatarUrl;
    private Long creatorId;
    private List<Long> memberIds;
}