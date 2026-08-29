package com.chatapp.backend.controller;

import com.chatapp.backend.dto.ConversationResponse;
import com.chatapp.backend.dto.CreateDirectChatRequest;
import com.chatapp.backend.dto.MessageResponse;
import com.chatapp.backend.dto.SendMessageRequest;
import com.chatapp.backend.entity.Conversation;
import com.chatapp.backend.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ChatController {

    private final ChatService chatService;

    @PostMapping("/conversations/direct")
    public ResponseEntity<Conversation> createDirectChat(@RequestBody CreateDirectChatRequest request) {
        return ResponseEntity.ok(chatService.createDirectChat(request));
    }

    @PostMapping("/messages")
    public ResponseEntity<MessageResponse> sendMessage(@RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(chatService.sendMessage(request));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<MessageResponse>> getMessages(@PathVariable Long conversationId) {
        return ResponseEntity.ok(chatService.getMessages(conversationId));
    }

    @GetMapping("/conversations/my-chats/{userId}")
    public ResponseEntity<List<ConversationResponse>> getMyConversations(@PathVariable Long userId) {
        return ResponseEntity.ok(chatService.getUserConversations(userId));
    }
}