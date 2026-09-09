package com.chatapp.backend.dto;

import com.chatapp.backend.entity.MessageType;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageResponse {
    private Long id;
    private Long conversationId;
    private Long senderId;
    private String senderName;
    private String content;
    private MessageType messageType;
    private String mediaUrl;
    private String fileName;
    private Long fileSize;
    private Boolean isEdited;
    private Boolean isDeleted;
    private Boolean isPinned;
    private ReplyPreviewResponse replyTo;
    private List<ReactionResponse> reactions;
    private LocalDateTime createdAt;
}