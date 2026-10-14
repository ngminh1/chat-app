package com.chatapp.backend.controller;

import com.chatapp.backend.dto.*;
import com.chatapp.backend.entity.Conversation;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.service.ChatService;
import com.chatapp.backend.service.MissingConversationKeyException;
import com.chatapp.backend.security.RequestAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final RequestAccess access;

    @ExceptionHandler(MissingConversationKeyException.class)
    public ResponseEntity<Map<String, String>> missingConversationKey() {
        return ResponseEntity.status(org.springframework.http.HttpStatus.CONFLICT)
                .body(Map.of("code", "CONVERSATION_AES_KEY_MISSING"));
    }

    // Real-time Presence
    @PutMapping("/presence")
    public ResponseEntity<Void> updatePresence(
            @RequestParam Long userId,
            @RequestParam boolean isOnline) {
        access.requireSelf(userId);
        chatService.updateUserPresence(userId, isOnline);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/conversations/{conversationId}/aes-key")
    public ResponseEntity<AesKeyResponse> getConversationAesKey(
            @PathVariable Long conversationId,
            @AuthenticationPrincipal User authenticatedUser) {
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.getOrCreateConversationAesKey(conversationId, authenticatedUser.getId()));
    }

    // Chat Themes
    @PutMapping("/conversations/{conversationId}/theme")
    public ResponseEntity<Conversation> updateTheme(
            @PathVariable Long conversationId,
            @RequestParam String theme) {
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.updateConversationTheme(conversationId, theme));
    }

    // Kho lưu trữ Media & Tệp
    @GetMapping("/conversations/{conversationId}/media")
    public ResponseEntity<List<MessageResponse>> getConversationMedia(@PathVariable Long conversationId) {
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.getConversationMedia(conversationId));
    }

    // Chuyển tiếp tin nhắn (Forward Message)
    @PostMapping("/messages/forward")
    public ResponseEntity<List<MessageResponse>> forwardMessage(@RequestBody ForwardMessageRequest request) {
        access.requireSelf(request.getSenderId());
        access.requireMessageMember(request.getMessageId());
        if (request.getTargetConversationIds() == null) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        for (Long id : request.getTargetConversationIds()) access.requireMember(id);
        return ResponseEntity.ok(chatService.forwardMessage(request));
    }

    // Chat 1-1
    @PostMapping("/conversations/direct")
    public ResponseEntity<Conversation> createDirectChat(@RequestBody CreateDirectChatRequest request) {
        access.requireSelf(request.getUser1Id());
        return ResponseEntity.ok(chatService.createDirectChat(request));
    }

    // Chat Nhóm
    @PostMapping("/conversations/group")
    public ResponseEntity<Conversation> createGroupChat(@RequestBody CreateGroupChatRequest request) {
        access.requireSelf(request.getCreatorId());
        return ResponseEntity.ok(chatService.createGroupChat(request));
    }

    @GetMapping("/conversations/{conversationId}/members")
    public ResponseEntity<List<GroupMemberResponse>> getGroupMembers(@PathVariable Long conversationId) {
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.getGroupMembers(conversationId));
    }

    @PostMapping("/conversations/{conversationId}/members")
    public ResponseEntity<Void> addGroupMember(
            @PathVariable Long conversationId,
            @RequestParam Long currentUserId,
            @RequestParam Long targetUserId) {
        access.requireSelf(currentUserId);
        access.requireMember(conversationId);
        chatService.addGroupMember(conversationId, currentUserId, targetUserId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/conversations/{conversationId}/members/{targetUserId}")
    public ResponseEntity<Void> removeGroupMember(
            @PathVariable Long conversationId,
            @RequestParam Long currentUserId,
            @PathVariable Long targetUserId) {
        access.requireSelf(currentUserId);
        access.requireMember(conversationId);
        chatService.removeGroupMember(conversationId, currentUserId, targetUserId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/conversations/{conversationId}/leave")
    public ResponseEntity<Void> leaveGroup(
            @PathVariable Long conversationId,
            @RequestParam Long userId) {
        access.requireSelf(userId);
        access.requireMember(conversationId);
        chatService.leaveGroup(conversationId, userId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/conversations/{conversationId}/group-info")
    public ResponseEntity<Conversation> updateGroupInfo(
            @PathVariable Long conversationId,
            @RequestParam Long currentUserId,
            @RequestBody UpdateGroupRequest request) {
        access.requireSelf(currentUserId);
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.updateGroupInfo(conversationId, currentUserId, request));
    }

    // Tin nhắn
    @PostMapping("/messages")
    public ResponseEntity<MessageResponse> sendMessage(@RequestBody SendMessageRequest request) {
        access.requireSelf(request.getSenderId());
        access.requireMember(request.getConversationId());
        return ResponseEntity.ok(chatService.sendMessage(request));
    }

    @PutMapping("/messages/edit")
    public ResponseEntity<MessageResponse> editMessage(@RequestBody EditMessageRequest request) {
        access.requireSelf(request.getSenderId());
        access.requireMessageMember(request.getMessageId());
        return ResponseEntity.ok(chatService.editMessage(request));
    }

    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<MessageResponse> deleteMessage(
            @PathVariable Long messageId,
            @RequestParam Long senderId) {
        access.requireSelf(senderId);
        access.requireMessageMember(messageId);
        return ResponseEntity.ok(chatService.deleteMessage(messageId, senderId));
    }

    @PostMapping("/messages/reaction")
    public ResponseEntity<MessageResponse> toggleReaction(@RequestBody ReactionRequest request) {
        access.requireSelf(request.getUserId());
        access.requireMessageMember(request.getMessageId());
        return ResponseEntity.ok(chatService.toggleReaction(request));
    }

    @PutMapping("/messages/{messageId}/pin")
    public ResponseEntity<MessageResponse> togglePinMessage(
            @PathVariable Long messageId,
            @RequestParam Long userId) {
        access.requireSelf(userId);
        access.requireMessageMember(messageId);
        return ResponseEntity.ok(chatService.togglePinMessage(messageId, userId));
    }

    @GetMapping("/conversations/{conversationId}/pinned")
    public ResponseEntity<List<MessageResponse>> getPinnedMessages(@PathVariable Long conversationId) {
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.getPinnedMessages(conversationId));
    }

    @GetMapping("/conversations/{conversationId}/search")
    public ResponseEntity<List<MessageResponse>> searchMessages(
            @PathVariable Long conversationId,
            @RequestParam String query) {
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.searchMessages(conversationId, query));
    }

    @PostMapping("/typing")
    public ResponseEntity<Void> sendTypingEvent(@RequestBody TypingRequest request) {
        access.requireSelf(request.getUserId());
        access.requireMember(request.getConversationId());
        chatService.sendTypingEvent(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<MessageResponse>> getMessages(@PathVariable Long conversationId) {
        access.requireMember(conversationId);
        return ResponseEntity.ok(chatService.getMessages(conversationId));
    }

    @GetMapping("/conversations/my-chats/{userId}")
    public ResponseEntity<List<ConversationResponse>> getMyConversations(@PathVariable Long userId) {
        access.requireSelf(userId);
        return ResponseEntity.ok(chatService.getUserConversations(userId));
    }

    @PutMapping("/conversations/{conversationId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long conversationId,
            @RequestParam Long userId) {
        access.requireSelf(userId);
        access.requireMember(conversationId);
        chatService.markConversationAsRead(conversationId, userId);
        return ResponseEntity.ok().build();
    }
}
