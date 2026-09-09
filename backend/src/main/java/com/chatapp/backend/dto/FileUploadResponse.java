package com.chatapp.backend.dto;

import com.chatapp.backend.entity.MessageType;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileUploadResponse {
    private String fileUrl;
    private String fileName;
    private Long fileSize;
    private MessageType messageType;
}