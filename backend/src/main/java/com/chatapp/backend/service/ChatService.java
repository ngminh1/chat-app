package com.chatapp.backend.service;

import com.chatapp.backend.dto.ConversationResponse;
import com.chatapp.backend.dto.CreateDirectChatRequest;
import com.chatapp.backend.dto.MessageResponse;
import com.chatapp.backend.dto.SendMessageRequest;
import com.chatapp.backend.dto.UserResponse;
import com.chatapp.backend.entity.*;
import com.chatapp.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public Conversation createDirectChat(CreateDirectChatRequest request) {
        List<Conversation> existingChats = conversationRepository
                .findDirectConversationBetweenUsers(request.getUser1Id(), request.getUser2Id());

        if (!existingChats.isEmpty()) {
            return existingChats.get(0);
        }

        User user1 = userRepository.findById(request.getUser1Id())
                .orElseThrow(() -> new RuntimeException("User 1 không tồn tại"));
        User user2 = userRepository.findById(request.getUser2Id())
                .orElseThrow(() -> new RuntimeException("User 2 không tồn tại"));

        Conversation conversation = Conversation.builder()
                .type(ConversationType.DIRECT)
                .build();
        Conversation savedConversation = conversationRepository.save(conversation);

        conversationMemberRepository.save(ConversationMember.builder()
                .conversation(savedConversation)
                .user(user1)
                .build());

        conversationMemberRepository.save(ConversationMember.builder()
                .conversation(savedConversation)
                .user(user2)
                .build());

        return savedConversation;
    }

    @Transactional
    public MessageResponse sendMessage(SendMessageRequest request) {
        Conversation conversation = conversationRepository.findById(request.getConversationId())
                .orElseThrow(() -> new RuntimeException("Cuộc trò chuyện không tồn tại"));

        User sender = userRepository.findById(request.getSenderId())
                .orElseThrow(() -> new RuntimeException("Người gửi không tồn tại"));

        Message message = Message.builder()
                .conversation(conversation)
                .sender(sender)
                .content(request.getContent())
                .build();

        Message savedMessage = messageRepository.save(message);

        MessageResponse response = MessageResponse.builder()
                .id(savedMessage.getId())
                .conversationId(conversation.getId())
                .senderId(sender.getId())
                .senderName(sender.getDisplayName())
                .content(savedMessage.getContent())
                .createdAt(savedMessage.getCreatedAt())
                .build();

        messagingTemplate.convertAndSend("/topic/conversations/" + conversation.getId(), response);

        return response;
    }

    public List<MessageResponse> getMessages(Long conversationId) {
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .map(msg -> MessageResponse.builder()
                        .id(msg.getId())
                        .conversationId(msg.getConversation().getId())
                        .senderId(msg.getSender().getId())
                        .senderName(msg.getSender().getDisplayName())
                        .content(msg.getContent())
                        .createdAt(msg.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    public List<ConversationResponse> getUserConversations(Long currentUserId) {
        List<ConversationMember> memberships = conversationMemberRepository.findByUserId(currentUserId);
        List<ConversationResponse> responses = new ArrayList<>();

        for (ConversationMember member : memberships) {
            Conversation conv = member.getConversation();
            
            // Tìm đối phương trong phòng chat 1-1
            List<ConversationMember> allMembers = conversationMemberRepository.findByConversationId(conv.getId());
            Optional<User> otherUserOpt = allMembers.stream()
                    .map(ConversationMember::getUser)
                    .filter(u -> !u.getId().equals(currentUserId))
                    .findFirst();

            if (otherUserOpt.isEmpty()) continue;
            User otherUser = otherUserOpt.get();

            // Tìm tin nhắn gần nhất
            Optional<Message> latestMsg = messageRepository.findTopByConversationIdOrderByCreatedAtDesc(conv.getId());

            String lastMessage = latestMsg.map(Message::getContent).orElse("Chưa có tin nhắn nào");
            LocalDateTime lastMessageTime = latestMsg.map(Message::getCreatedAt).orElse(conv.getCreatedAt());

            responses.add(ConversationResponse.builder()
                    .conversationId(conv.getId())
                    .otherUser(UserResponse.builder()
                            .id(otherUser.getId())
                            .username(otherUser.getUsername())
                            .displayName(otherUser.getDisplayName())
                            .avatarUrl(otherUser.getAvatarUrl())
                            .createdAt(otherUser.getCreatedAt())
                            .build())
                    .lastMessage(lastMessage)
                    .lastMessageTime(lastMessageTime)
                    .build());
        }

        // Sắp xếp cuộc trò chuyện có tin nhắn mới nhất lên đầu danh sách
        responses.sort(Comparator.comparing(ConversationResponse::getLastMessageTime, Comparator.nullsLast(Comparator.naturalOrder())).reversed());

        return responses;
    }
}