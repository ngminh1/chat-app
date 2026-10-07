package com.chatapp.backend.controller;

import com.chatapp.backend.dto.*;
import com.chatapp.backend.entity.Conversation;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ChatController {

    private final ChatService chatService;

    // Real-time Presence
    @PutMapping("/presence")
    public ResponseEntity<Void> updatePresence(
            @RequestParam Long userId,
            @RequestParam boolean isOnline) {
        chatService.updateUserPresence(userId, isOnline);
        return ResponseEntity.ok().build();
    }

    // MIGRATION ONLY: raw AES key chỉ tồn tại cho conversation chưa migrate ElGamal.
    @GetMapping("/conversations/{conversationId}/aes-key")
    public ResponseEntity<AesKeyResponse> getConversationAesKey(
            @PathVariable Long conversationId,
            @AuthenticationPrincipal User authenticatedUser) {
        return ResponseEntity.ok(chatService.getOrCreateConversationAesKey(conversationId, authenticatedUser.getId()));
    }

    @GetMapping("/conversations/{conversationId}/crypto-members")
    public ResponseEntity<List<CryptoMemberResponse>> getConversationCryptoMembers(
            @PathVariable Long conversationId,
            @AuthenticationPrincipal User authenticatedUser) {
        return ResponseEntity.ok(chatService.getConversationCryptoMembers(conversationId, authenticatedUser.getId()));
    }

    @GetMapping("/conversations/{conversationId}/wrapped-key")
    public ResponseEntity<WrappedKeyResponse> getConversationWrappedKey(
            @PathVariable Long conversationId,
            @AuthenticationPrincipal User authenticatedUser) {
        WrappedKeyResponse response = chatService.getConversationWrappedKey(conversationId, authenticatedUser.getId());
        return response != null ? ResponseEntity.ok(response) : ResponseEntity.noContent().build();
    }

    @PostMapping("/conversations/{conversationId}/wrapped-keys")
    public ResponseEntity<Void> saveConversationWrappedKeys(
            @PathVariable Long conversationId,
            @RequestBody WrappedKeyBatchRequest request,
            @AuthenticationPrincipal User authenticatedUser) {
        chatService.saveConversationWrappedKeys(conversationId, authenticatedUser.getId(), request);
        return ResponseEntity.ok().build();
    }

    // Chat Themes
    @PutMapping("/conversations/{conversationId}/theme")
    public ResponseEntity<Conversation> updateTheme(
            @PathVariable Long conversationId,
            @RequestParam String theme) {
        return ResponseEntity.ok(chatService.updateConversationTheme(conversationId, theme));
    }

    // Kho lưu trữ Media & Tệp
    @GetMapping("/conversations/{conversationId}/media")
    public ResponseEntity<List<MessageResponse>> getConversationMedia(@PathVariable Long conversationId) {
        return ResponseEntity.ok(chatService.getConversationMedia(conversationId));
    }

    // Chuyển tiếp tin nhắn (Forward Message)
    @PostMapping("/messages/forward")
    public ResponseEntity<List<MessageResponse>> forwardMessage(@RequestBody ForwardMessageRequest request) {
        return ResponseEntity.ok(chatService.forwardMessage(request));
    }

    // Chat 1-1
    @PostMapping("/conversations/direct")
    public ResponseEntity<Conversation> createDirectChat(@RequestBody CreateDirectChatRequest request) {
        return ResponseEntity.ok(chatService.createDirectChat(request));
    }

    // Chat Nhóm
    @PostMapping("/conversations/group")
    public ResponseEntity<Conversation> createGroupChat(@RequestBody CreateGroupChatRequest request) {
        return ResponseEntity.ok(chatService.createGroupChat(request));
    }

    @GetMapping("/conversations/{conversationId}/members")
    public ResponseEntity<List<GroupMemberResponse>> getGroupMembers(@PathVariable Long conversationId) {
        return ResponseEntity.ok(chatService.getGroupMembers(conversationId));
    }

    @PostMapping("/conversations/{conversationId}/members")
    public ResponseEntity<Void> addGroupMember(
            @PathVariable Long conversationId,
            @RequestParam Long currentUserId,
            @RequestParam Long targetUserId,
            @RequestBody(required = false) WrappedKeyItem wrappedKey) {
        chatService.addGroupMember(conversationId, currentUserId, targetUserId, wrappedKey);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/conversations/{conversationId}/members/{targetUserId}")
    public ResponseEntity<Void> removeGroupMember(
            @PathVariable Long conversationId,
            @RequestParam Long currentUserId,
            @PathVariable Long targetUserId) {
        chatService.removeGroupMember(conversationId, currentUserId, targetUserId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/conversations/{conversationId}/leave")
    public ResponseEntity<Void> leaveGroup(
            @PathVariable Long conversationId,
            @RequestParam Long userId) {
        chatService.leaveGroup(conversationId, userId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/conversations/{conversationId}/group-info")
    public ResponseEntity<Conversation> updateGroupInfo(
            @PathVariable Long conversationId,
            @RequestParam Long currentUserId,
            @RequestBody UpdateGroupRequest request) {
        return ResponseEntity.ok(chatService.updateGroupInfo(conversationId, currentUserId, request));
    }

    // Tin nhắn
    @PostMapping("/messages")
    public ResponseEntity<MessageResponse> sendMessage(@RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(chatService.sendMessage(request));
    }

    @PutMapping("/messages/edit")
    public ResponseEntity<MessageResponse> editMessage(@RequestBody EditMessageRequest request) {
        return ResponseEntity.ok(chatService.editMessage(request));
    }

    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<MessageResponse> deleteMessage(
            @PathVariable Long messageId,
            @RequestParam Long senderId) {
        return ResponseEntity.ok(chatService.deleteMessage(messageId, senderId));
    }

    @PostMapping("/messages/reaction")
    public ResponseEntity<MessageResponse> toggleReaction(@RequestBody ReactionRequest request) {
        return ResponseEntity.ok(chatService.toggleReaction(request));
    }

    @PutMapping("/messages/{messageId}/pin")
    public ResponseEntity<MessageResponse> togglePinMessage(
            @PathVariable Long messageId,
            @RequestParam Long userId) {
        return ResponseEntity.ok(chatService.togglePinMessage(messageId, userId));
    }

    @GetMapping("/conversations/{conversationId}/pinned")
    public ResponseEntity<List<MessageResponse>> getPinnedMessages(@PathVariable Long conversationId) {
        return ResponseEntity.ok(chatService.getPinnedMessages(conversationId));
    }

    @GetMapping("/conversations/{conversationId}/search")
    public ResponseEntity<List<MessageResponse>> searchMessages(
            @PathVariable Long conversationId,
            @RequestParam String query) {
        return ResponseEntity.ok(chatService.searchMessages(conversationId, query));
    }

    @PostMapping("/typing")
    public ResponseEntity<Void> sendTypingEvent(@RequestBody TypingRequest request) {
        chatService.sendTypingEvent(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<MessageResponse>> getMessages(@PathVariable Long conversationId) {
        return ResponseEntity.ok(chatService.getMessages(conversationId));
    }

    @GetMapping("/conversations/my-chats/{userId}")
    public ResponseEntity<List<ConversationResponse>> getMyConversations(@PathVariable Long userId) {
        return ResponseEntity.ok(chatService.getUserConversations(userId));
    }

    @PutMapping("/conversations/{conversationId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long conversationId,
            @RequestParam Long userId) {
        chatService.markConversationAsRead(conversationId, userId);
        return ResponseEntity.ok().build();
    }
}