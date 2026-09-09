package com.chatapp.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReactionResponse {
    private Long id;
    private Long userId;
    private String userName;
    private String reaction;
}