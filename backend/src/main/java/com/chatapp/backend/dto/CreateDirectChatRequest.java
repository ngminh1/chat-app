package com.chatapp.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateDirectChatRequest {
    private Long user1Id;
    private Long user2Id;
}