
package com.chatapp.backend.service;

import com.chatapp.backend.dto.*;
import com.chatapp.backend.entity.*;
import com.chatapp.backend.repository.*;
import com.chatapp.backend.util.SHA;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final MessageRepository messageRepository;
    private final MessageReactionRepository messageReactionRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * MIGRATION ONLY: lấy raw AES key khi conversation chưa có wrapped key ElGamal.
     *
     * Luồng mới sẽ lập tức bọc key này bằng public key ElGamal của từng thành viên và
     * xóa raw key khỏi Conversation khi tất cả thành viên đã có wrapped key.
     * Nếu conversation đã migrate thì TUYỆT ĐỐI không sinh key mới, vì sinh key mới
     * sẽ làm toàn bộ ciphertext cũ không thể giải mã.
     */
    public synchronized AesKeyResponse getOrCreateConversationAesKey(Long conversationId, Long userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Cuộc trò chuyện không tồn tại"));

        conversationMemberRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên của cuộc trò chuyện này"));

        if (conversation.getAesKey() == null || conversation.getAesKey().isBlank()) {
            List<ConversationMember> members = conversationMemberRepository.findByConversationId(conversationId);
            boolean alreadyMigrated = members.stream().anyMatch(this::hasWrappedKey);
            if (alreadyMigrated) {
                throw new RuntimeException("Conversation đã dùng ElGamal wrapped key; không được sinh raw AES key mới");
            }

            byte[] rawKey = new byte[32]; // 256 bit
            new SecureRandom().nextBytes(rawKey);
            conversation.setAesKey(Base64.getEncoder().encodeToString(rawKey));
            conversationRepository.save(conversation);
        }

        return AesKeyResponse.builder()
                .conversationId(conversationId)
                .key(conversation.getAesKey())
                .build();
    }

    public List<CryptoMemberResponse> getConversationCryptoMembers(Long conversationId, Long requesterId) {
        conversationMemberRepository.findByConversationIdAndUserId(conversationId, requesterId)
                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên của cuộc trò chuyện này"));

        return conversationMemberRepository.findByConversationId(conversationId).stream()
                .map(member -> CryptoMemberResponse.builder()
                        .userId(member.getUser().getId())
                        .publicKey(member.getUser().getElgamalPublicKey())
                        .keyVersion(member.getUser().getElgamalKeyVersion() != null
                                ? member.getUser().getElgamalKeyVersion()
                                : 1)
                        .hasWrappedKey(hasWrappedKey(member))
                        .build())
                .collect(Collectors.toList());
    }

    public WrappedKeyResponse getConversationWrappedKey(Long conversationId, Long userId) {
        ConversationMember member = conversationMemberRepository
                .findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên của cuộc trò chuyện này"));

        if (!hasWrappedKey(member)) {
            return null;
        }

        return WrappedKeyResponse.builder()
                .conversationId(conversationId)
                .userId(userId)
                .c1(member.getEncryptedAesKeyC1())
                .c2(member.getEncryptedAesKeyC2())
                .keyVersion(member.getWrappedKeyVersion() != null ? member.getWrappedKeyVersion() : 1)
                .build();
    }

    public void saveConversationWrappedKeys(
            Long conversationId,
            Long requesterId,
            WrappedKeyBatchRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Cuộc trò chuyện không tồn tại"));

        conversationMemberRepository.findByConversationIdAndUserId(conversationId, requesterId)
                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên của cuộc trò chuyện này"));

        if (request == null || request.getKeys() == null || request.getKeys().isEmpty()) {
            throw new RuntimeException("Danh sách wrapped key rỗng");
        }

        for (WrappedKeyItem item : request.getKeys()) {
            if (item.getUserId() == null
                    || item.getC1() == null || !item.getC1().matches("\\d+")
                    || item.getC2() == null || !item.getC2().matches("\\d+")) {
                throw new RuntimeException("Wrapped key ElGamal không hợp lệ");
            }

            ConversationMember target = conversationMemberRepository
                    .findByConversationIdAndUserId(conversationId, item.getUserId())
                    .orElseThrow(() -> new RuntimeException("Wrapped key chứa user không thuộc conversation"));

            // Sau khi raw AES key đã bị xóa, không cho batch migration ghi đè wrapped key đã có.
            // Điều này tránh một member làm hỏng lịch sử của member khác bằng c1/c2 giả.
            if (hasWrappedKey(target)
                    && (conversation.getAesKey() == null || conversation.getAesKey().isBlank())) {
                continue;
            }

            int targetKeyVersion = target.getUser().getElgamalKeyVersion() != null
                    ? target.getUser().getElgamalKeyVersion()
                    : 1;
            int suppliedKeyVersion = item.getKeyVersion() != null ? item.getKeyVersion() : 1;
            if (suppliedKeyVersion != targetKeyVersion) {
                throw new RuntimeException("Wrapped key version không khớp public key của user");
            }

            target.setEncryptedAesKeyC1(item.getC1());
            target.setEncryptedAesKeyC2(item.getC2());
            target.setWrappedKeyVersion(suppliedKeyVersion);
            conversationMemberRepository.save(target);
        }

        clearLegacyAesKeyIfFullyWrapped(conversation);
    }

    private boolean hasWrappedKey(ConversationMember member) {
        return member.getEncryptedAesKeyC1() != null
                && !member.getEncryptedAesKeyC1().isBlank()
                && member.getEncryptedAesKeyC2() != null
                && !member.getEncryptedAesKeyC2().isBlank();
    }

    private void clearLegacyAesKeyIfFullyWrapped(Conversation conversation) {
        List<ConversationMember> members = conversationMemberRepository.findByConversationId(conversation.getId());
        if (!members.isEmpty() && members.stream().allMatch(this::hasWrappedKey)) {
            conversation.setAesKey(null);
            conversationRepository.save(conversation);
        }
    }

    public void updateUserPresence(Long userId, boolean isOnline) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setIsOnline(isOnline);
            user.setLastSeenAt(LocalDateTime.now());
            userRepository.save(user);

            PresenceResponse presence = PresenceResponse.builder()
                    .userId(user.getId())
                    .isOnline(isOnline)
                    .lastSeenAt(user.getLastSeenAt())
                    .build();

            messagingTemplate.convertAndSend("/topic/presence", presence);
        });
    }

    public Conversation updateConversationTheme(Long conversationId, String theme) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Cuộc trò chuyện không tồn tại"));
        conv.setTheme(theme);
        Conversation saved = conversationRepository.save(conv);

        messagingTemplate.convertAndSend("/topic/conversations/" + conversationId + "/theme", theme);
        return saved;
    }

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
                .theme("blue")
                .build();
        Conversation savedConversation = conversationRepository.save(conversation);

        ConversationMember member1 = ConversationMember.builder()
                .conversation(savedConversation)
                .user(user1)
                .role(MemberRole.MEMBER)
                .lastReadAt(LocalDateTime.now())
                .build();
        conversationMemberRepository.save(member1);

        ConversationMember member2 = ConversationMember.builder()
                .conversation(savedConversation)
                .user(user2)
                .role(MemberRole.MEMBER)
                .lastReadAt(LocalDateTime.now())
                .build();
        conversationMemberRepository.save(member2);

        return savedConversation;
    }

    public Conversation createGroupChat(CreateGroupChatRequest request) {
        User creator = userRepository.findById(request.getCreatorId())
                .orElseThrow(() -> new RuntimeException("Người tạo nhóm không tồn tại"));

        String groupTitle = (request.getTitle() != null && !request.getTitle().trim().isEmpty())
                ? request.getTitle().trim()
                : "Nhóm của " + creator.getDisplayName();

        Conversation group = Conversation.builder()
                .type(ConversationType.GROUP)
                .title(groupTitle)
                .avatarUrl(request.getAvatarUrl())
                .theme("blue")
                .build();
        Conversation savedGroup = conversationRepository.save(group);

        ConversationMember adminMember = ConversationMember.builder()
                .conversation(savedGroup)
                .user(creator)
                .role(MemberRole.ADMIN)
                .lastReadAt(LocalDateTime.now())
                .build();
        conversationMemberRepository.save(adminMember);

        Set<Long> uniqueMemberIds = new HashSet<>(request.getMemberIds() != null ? request.getMemberIds() : List.of());
        uniqueMemberIds.remove(creator.getId());

        for (Long memberId : uniqueMemberIds) {
            userRepository.findById(memberId).ifPresent(user -> {
                ConversationMember member = ConversationMember.builder()
                        .conversation(savedGroup)
                        .user(user)
                        .role(MemberRole.MEMBER)
                        .lastReadAt(LocalDateTime.now())
                        .build();
                conversationMemberRepository.save(member);
            });
        }

        sendSystemMessage(savedGroup, creator, creator.getDisplayName() + " đã tạo nhóm \"" + groupTitle + "\"");
        return savedGroup;
    }

    public void addGroupMember(
            Long conversationId,
            Long currentUserId,
            Long targetUserId,
            WrappedKeyItem wrappedKey) {
        Conversation conv = getGroupConversation(conversationId);
        validateGroupMembership(conv.getId(), currentUserId);

        Optional<ConversationMember> existing = conversationMemberRepository.findByConversationIdAndUserId(conv.getId(), targetUserId);
        if (existing.isPresent()) {
            throw new RuntimeException("Người dùng đã ở trong nhóm");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new RuntimeException("User hiện tại không tồn tại"));

        boolean conversationAlreadyMigrated = conv.getAesKey() == null
                && conversationMemberRepository.findByConversationId(conv.getId()).stream().anyMatch(this::hasWrappedKey);

        if (conversationAlreadyMigrated
                && (wrappedKey == null || wrappedKey.getC1() == null || wrappedKey.getC2() == null)) {
            throw new RuntimeException("Conversation đã dùng ElGamal. Cần wrapped AES key cho thành viên mới.");
        }

        if (wrappedKey != null) {
            if (wrappedKey.getUserId() != null && !targetUserId.equals(wrappedKey.getUserId())) {
                throw new RuntimeException("Wrapped key không thuộc thành viên đang được thêm");
            }
            if (wrappedKey.getC1() == null || !wrappedKey.getC1().matches("\\d+")
                    || wrappedKey.getC2() == null || !wrappedKey.getC2().matches("\\d+")) {
                throw new RuntimeException("Wrapped key ElGamal không hợp lệ");
            }
            int targetKeyVersion = targetUser.getElgamalKeyVersion() != null
                    ? targetUser.getElgamalKeyVersion()
                    : 1;
            int suppliedKeyVersion = wrappedKey.getKeyVersion() != null ? wrappedKey.getKeyVersion() : 1;
            if (suppliedKeyVersion != targetKeyVersion) {
                throw new RuntimeException("Wrapped key version không khớp public key của thành viên mới");
            }
        }

        ConversationMember newMember = ConversationMember.builder()
                .conversation(conv)
                .user(targetUser)
                .role(MemberRole.MEMBER)
                .lastReadAt(LocalDateTime.now())
                .encryptedAesKeyC1(wrappedKey != null ? wrappedKey.getC1() : null)
                .encryptedAesKeyC2(wrappedKey != null ? wrappedKey.getC2() : null)
                .wrappedKeyVersion(wrappedKey != null && wrappedKey.getKeyVersion() != null
                        ? wrappedKey.getKeyVersion()
                        : null)
                .build();
        conversationMemberRepository.save(newMember);
        clearLegacyAesKeyIfFullyWrapped(conv);

        sendSystemMessage(conv, currentUser, currentUser.getDisplayName() + " đã thêm " + targetUser.getDisplayName() + " vào nhóm");
    }

    public void removeGroupMember(Long conversationId, Long currentUserId, Long targetUserId) {
        Conversation conv = getGroupConversation(conversationId);
        ConversationMember currentMember = conversationMemberRepository.findByConversationIdAndUserId(conv.getId(), currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không ở trong nhóm này"));

        if (currentMember.getRole() != MemberRole.ADMIN) {
            throw new RuntimeException("Chỉ Quản trị viên (Admin) mới có quyền xóa thành viên");
        }

        ConversationMember targetMember = conversationMemberRepository.findByConversationIdAndUserId(conv.getId(), targetUserId)
                .orElseThrow(() -> new RuntimeException("Thành viên không tồn tại trong nhóm"));

        User targetUser = targetMember.getUser();
        User currentUser = currentMember.getUser();

        conversationMemberRepository.delete(targetMember);
        notifyMembershipChangeAfterCommit(conv.getId(), targetUserId);
        sendSystemMessage(conv, currentUser, currentUser.getDisplayName() + " đã xóa " + targetUser.getDisplayName() + " khỏi nhóm");
    }

    public void leaveGroup(Long conversationId, Long userId) {
        Conversation conv = getGroupConversation(conversationId);
        ConversationMember member = conversationMemberRepository.findByConversationIdAndUserId(conv.getId(), userId)
                .orElseThrow(() -> new RuntimeException("Bạn không ở trong nhóm này"));

        User user = member.getUser();
        conversationMemberRepository.delete(member);
        notifyMembershipChangeAfterCommit(conv.getId(), userId);

        List<ConversationMember> remainingMembers = conversationMemberRepository.findByConversationId(conv.getId());
        if (remainingMembers.isEmpty()) {
            conversationRepository.delete(conv);
            return;
        }

        if (member.getRole() == MemberRole.ADMIN) {
            boolean hasOtherAdmin = remainingMembers.stream().anyMatch(m -> m.getRole() == MemberRole.ADMIN);
            if (!hasOtherAdmin) {
                ConversationMember newAdmin = remainingMembers.get(0);
                newAdmin.setRole(MemberRole.ADMIN);
                conversationMemberRepository.save(newAdmin);
            }
        }

        sendSystemMessage(conv, user, user.getDisplayName() + " đã rời khỏi nhóm");
    }

    public Conversation updateGroupInfo(Long conversationId, Long currentUserId, UpdateGroupRequest request) {
        Conversation conv = getGroupConversation(conversationId);
        ConversationMember currentMember = conversationMemberRepository.findByConversationIdAndUserId(conv.getId(), currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không ở trong nhóm này"));

        if (request.getTitle() != null && !request.getTitle().trim().isEmpty()) {
            conv.setTitle(request.getTitle().trim());
        }
        if (request.getAvatarUrl() != null) {
            conv.setAvatarUrl(request.getAvatarUrl().trim());
        }

        Conversation saved = conversationRepository.save(conv);
        sendSystemMessage(saved, currentMember.getUser(), currentMember.getUser().getDisplayName() + " đã cập nhật thông tin nhóm");
        return saved;
    }

    @Transactional(readOnly = true)
    public List<GroupMemberResponse> getGroupMembers(Long conversationId) {
        List<ConversationMember> members = conversationMemberRepository.findByConversationId(conversationId);
        List<GroupMemberResponse> result = new ArrayList<>();
        for (ConversationMember m : members) {
            User u = m.getUser();
            result.add(GroupMemberResponse.builder()
                    .userId(u.getId())
                    .username(u.getUsername())
                    .displayName(u.getDisplayName())
                    .avatarUrl(u.getAvatarUrl())
                    .role(m.getRole())
                    .joinedAt(m.getJoinedAt())
                    .build());
        }
        return result;
    }

    public MessageResponse sendMessage(SendMessageRequest request) {
        Conversation conversation = conversationRepository.findById(request.getConversationId())
                .orElseThrow(() -> new RuntimeException("Cuộc trò chuyện không tồn tại"));

        // Không bao giờ cho phép một tài khoản gửi vào hội thoại không tham gia.
        requireConversationMember(conversation.getId(), request.getSenderId());
        User sender = userRepository.findById(request.getSenderId())
                .orElseThrow(() -> new RuntimeException("Người gửi không tồn tại"));

        Message replyToMessage = null;
        if (request.getReplyToId() != null) {
            replyToMessage = messageRepository.findById(request.getReplyToId()).orElse(null);
            if (replyToMessage != null && !replyToMessage.getConversation().getId().equals(conversation.getId())) {
                throw new IllegalArgumentException("Không được reply tin nhắn từ hội thoại khác");
            }
        }

        MessageType type = request.getMessageType() != null ? request.getMessageType() : MessageType.TEXT;
        if (type == MessageType.SYSTEM) {
            throw new IllegalArgumentException("Chỉ backend mới được tạo thông báo SYSTEM");
        }

        boolean encryptedText = type == MessageType.TEXT
                && request.getCiphertext() != null && !request.getCiphertext().isBlank()
                && request.getIv() != null && !request.getIv().isBlank();

        // Hệ thống SYSTEM do service tạo riêng; TEXT gửi từ API phải là AES-GCM.
        if (type == MessageType.TEXT && !encryptedText) {
            throw new IllegalArgumentException("Tin nhắn TEXT phải được mã hóa AES-GCM");
        }

        if (encryptedText) {
            validateEncryptedPayload(
                    request.getCiphertext(),
                    request.getIv(),
                    request.getEncryptionVersion(),
                    request.getSha256()
            );
        }

        Message message = Message.builder()
                .conversation(conversation)
                .sender(sender)
                // TEXT AES mới không lưu plaintext vào DB.
                .content(encryptedText ? null : request.getContent())
                .ciphertext(encryptedText ? request.getCiphertext() : null)
                .iv(encryptedText ? request.getIv() : null)
                .encryptionVersion(encryptedText
                        ? (request.getEncryptionVersion() != null ? request.getEncryptionVersion() : "AES-256-GCM")
                        : null)
                .sha256(encryptedText ? request.getSha256().toLowerCase() : null)
                .messageType(type)
                .mediaUrl(request.getMediaUrl())
                .fileName(request.getFileName())
                .fileSize(request.getFileSize())
                .replyTo(replyToMessage)
                .isEdited(false)
                .isDeleted(false)
                .isPinned(false)
                .reactions(new ArrayList<>())
                .build();

        Message savedMessage = messageRepository.save(message);

        conversationMemberRepository.findByConversationIdAndUserId(conversation.getId(), sender.getId())
                .ifPresent(member -> {
                    member.setLastReadAt(savedMessage.getCreatedAt());
                    conversationMemberRepository.save(member);
                });

        MessageResponse response = mapToMessageResponse(savedMessage);

        messagingTemplate.convertAndSend("/topic/conversations/" + conversation.getId(), response);

        List<ConversationMember> members = conversationMemberRepository.findByConversationId(conversation.getId());
        for (ConversationMember member : members) {
            messagingTemplate.convertAndSend("/topic/users/" + member.getUser().getId() + "/messages", response);
        }

        return response;
    }

    // CHUYỂN TIẾP TIN NHẮN (FORWARD MESSAGE)
    public List<MessageResponse> forwardMessage(ForwardMessageRequest request) {
        Message originalMessage = messageRepository.findById(request.getMessageId())
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        if (originalMessage.getMessageType() == MessageType.TEXT) {
            throw new IllegalArgumentException("Chuyển tiếp TEXT phải mã hóa lại bằng khóa của hội thoại đích ở client");
        }

        if (Boolean.TRUE.equals(originalMessage.getIsDeleted())) {
            throw new RuntimeException("Không thể chuyển tiếp tin nhắn đã bị thu hồi");
        }

        User sender = userRepository.findById(request.getSenderId())
                .orElseThrow(() -> new RuntimeException("Người gửi không tồn tại"));

        List<MessageResponse> result = new ArrayList<>();

        for (Long targetConvId : request.getTargetConversationIds()) {
            Conversation targetConv = conversationRepository.findById(targetConvId).orElse(null);
            if (targetConv == null) continue;

            Message forwardedMsg = Message.builder()
                    .conversation(targetConv)
                    .sender(sender)
                    .content(originalMessage.getContent())
                    .messageType(originalMessage.getMessageType())
                    .mediaUrl(originalMessage.getMediaUrl())
                    .fileName(originalMessage.getFileName())
                    .fileSize(originalMessage.getFileSize())
                    .isEdited(false)
                    .isDeleted(false)
                    .isPinned(false)
                    .reactions(new ArrayList<>())
                    .build();

            Message saved = messageRepository.save(forwardedMsg);
            MessageResponse res = mapToMessageResponse(saved);
            result.add(res);

            messagingTemplate.convertAndSend("/topic/conversations/" + targetConv.getId(), res);

            List<ConversationMember> members = conversationMemberRepository.findByConversationId(targetConv.getId());
            for (ConversationMember m : members) {
                messagingTemplate.convertAndSend("/topic/users/" + m.getUser().getId() + "/messages", res);
            }
        }

        return result;
    }

    // KHO LƯU TRỮ MEDIA & TỆP (MEDIA GALLERY)
    @Transactional(readOnly = true)
    public List<MessageResponse> getConversationMedia(Long conversationId) {
        List<MessageType> mediaTypes = List.of(MessageType.IMAGE, MessageType.FILE);
        return messageRepository.findByConversationIdAndMessageTypeInAndIsDeletedFalseOrderByCreatedAtDesc(conversationId, mediaTypes)
                .stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    public MessageResponse togglePinMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        if (Boolean.TRUE.equals(message.getIsDeleted())) {
            throw new RuntimeException("Không thể ghim tin nhắn đã bị thu hồi");
        }

        boolean currentPinState = Boolean.TRUE.equals(message.getIsPinned());
        message.setIsPinned(!currentPinState);
        Message saved = messageRepository.save(message);

        MessageResponse response = mapToMessageResponse(saved);
        messagingTemplate.convertAndSend("/topic/conversations/" + message.getConversation().getId() + "/update", response);

        return response;
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getPinnedMessages(Long conversationId) {
        return messageRepository.findByConversationIdAndIsPinnedTrueOrderByCreatedAtDesc(conversationId)
                .stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> searchMessages(Long conversationId, String query) {
        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }
        return messageRepository.searchMessages(conversationId, query.trim())
                .stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    private void notifyMembershipChangeAfterCommit(Long conversationId, Long removedUserId) {
        List<Long> remainingIds = conversationMemberRepository
                .findByConversationId(conversationId)
                .stream()
                .map(m -> m.getUser().getId())
                .filter(id -> !id.equals(removedUserId))
                .toList();

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        Map<String, Object> removedEvent = Map.of(
                                "event", "GROUP_REMOVED",
                                "conversationId", conversationId
                        );

                        messagingTemplate.convertAndSend(
                                "/topic/users/" + removedUserId + "/messages",
                                (Object) removedEvent
                        );

                        Map<String, Object> changedEvent = Map.of(
                                "event", "GROUP_MEMBERS_CHANGED",
                                "conversationId", conversationId
                        );

                        for (Long id : remainingIds) {
                            messagingTemplate.convertAndSend(
                                    "/topic/users/" + id + "/messages",
                                    (Object) changedEvent
                            );
                        }
                    }
                }
        );
    }

    private void sendSystemMessage(Conversation conv, User sender, String content) {
        Message systemMsg = Message.builder()
                .conversation(conv)
                .sender(sender)
                .content(content)
                .messageType(MessageType.SYSTEM)
                .isEdited(false)
                .isDeleted(false)
                .isPinned(false)
                .build();
        Message saved = messageRepository.save(systemMsg);
        MessageResponse response = mapToMessageResponse(saved);

        messagingTemplate.convertAndSend("/topic/conversations/" + conv.getId(), response);

        List<ConversationMember> members = conversationMemberRepository.findByConversationId(conv.getId());
        for (ConversationMember m : members) {
            messagingTemplate.convertAndSend("/topic/users/" + m.getUser().getId() + "/messages", response);
        }
    }

    private Conversation getGroupConversation(Long convId) {
        Conversation conv = conversationRepository.findById(convId)
                .orElseThrow(() -> new RuntimeException("Phòng trò chuyện không tồn tại"));
        if (conv.getType() != null && conv.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Cuộc trò chuyện này không phải là nhóm");
        }
        return conv;
    }

    private void requireConversationMember(Long convId, Long userId) {
        conversationMemberRepository.findByConversationIdAndUserId(convId, userId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.FORBIDDEN, "Không thuộc hội thoại"));
    }

    private void validateGroupMembership(Long convId, Long userId) {
        conversationMemberRepository.findByConversationIdAndUserId(convId, userId)
                .orElseThrow(() -> new RuntimeException("Bạn không phải là thành viên trong nhóm này"));
    }

    public MessageResponse editMessage(EditMessageRequest request) {
        Message message = messageRepository.findById(request.getMessageId())
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        if (message.getMessageType() != MessageType.TEXT) {
            throw new IllegalArgumentException("Chỉ chỉnh sửa tin nhắn TEXT");
        }
        if (!message.getSender().getId().equals(request.getSenderId())) {
            throw new RuntimeException("Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình");
        }

        if (Boolean.TRUE.equals(message.getIsDeleted())) {
            throw new RuntimeException("Không thể chỉnh sửa tin nhắn đã bị thu hồi");
        }

        boolean encryptedEdit = request.getCiphertext() != null && !request.getCiphertext().isBlank()
                && request.getIv() != null && !request.getIv().isBlank();

        if (!encryptedEdit) {
            throw new IllegalArgumentException("Nội dung chỉnh sửa phải được mã hóa AES-GCM");
        }
        validateEncryptedPayload(
                request.getCiphertext(), request.getIv(),
                request.getEncryptionVersion(), request.getSha256()
        );
        message.setContent(null);
        message.setCiphertext(request.getCiphertext());
        message.setIv(request.getIv());
        message.setEncryptionVersion("AES-256-GCM");
        message.setSha256(request.getSha256().toLowerCase());
        message.setIsEdited(true);
        Message saved = messageRepository.save(message);

        MessageResponse response = mapToMessageResponse(saved);
        messagingTemplate.convertAndSend("/topic/conversations/" + message.getConversation().getId() + "/update", response);

        return response;
    }

    public MessageResponse deleteMessage(Long messageId, Long senderId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        if (!message.getSender().getId().equals(senderId)) {
            throw new RuntimeException("Bạn chỉ có thể thu hồi tin nhắn của chính mình");
        }

        message.setIsDeleted(true);
        message.setContent("Tin nhắn đã bị thu hồi");
        message.setCiphertext(null);
        message.setIv(null);
        message.setEncryptionVersion(null);
        message.setSha256(null);
        message.setMediaUrl(null);
        message.setFileName(null);
        message.setFileSize(null);
        message.setIsPinned(false);
        message.setMessageType(MessageType.TEXT);
        if (message.getReactions() != null) {
            message.getReactions().clear();
        }
        Message saved = messageRepository.save(message);

        MessageResponse response = mapToMessageResponse(saved);
        messagingTemplate.convertAndSend("/topic/conversations/" + message.getConversation().getId() + "/update", response);

        return response;
    }

    public MessageResponse toggleReaction(ReactionRequest request) {
        Message message = messageRepository.findById(request.getMessageId())
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        if (Boolean.TRUE.equals(message.getIsDeleted())) {
            throw new RuntimeException("Không thể thả cảm xúc trên tin nhắn đã thu hồi");
        }

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        Optional<MessageReaction> existing = messageReactionRepository.findByMessageIdAndUserId(message.getId(), user.getId());

        if (existing.isPresent()) {
            MessageReaction currentReaction = existing.get();
            if (currentReaction.getReaction().equals(request.getReaction())) {
                message.getReactions().remove(currentReaction);
                messageReactionRepository.delete(currentReaction);
            } else {
                currentReaction.setReaction(request.getReaction());
                messageReactionRepository.save(currentReaction);
            }
        } else {
            MessageReaction newReaction = MessageReaction.builder()
                    .message(message)
                    .user(user)
                    .reaction(request.getReaction())
                    .build();
            if (message.getReactions() == null) {
                message.setReactions(new ArrayList<>());
            }
            message.getReactions().add(newReaction);
            messageReactionRepository.save(newReaction);
        }

        Message updatedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(updatedMessage);

        messagingTemplate.convertAndSend("/topic/conversations/" + message.getConversation().getId() + "/update", response);
        return response;
    }

    public void sendTypingEvent(TypingRequest request) {
        messagingTemplate.convertAndSend("/topic/conversations/" + request.getConversationId() + "/typing", request);
    }

    public void markConversationAsRead(Long conversationId, Long userId) {
        conversationMemberRepository.findByConversationIdAndUserId(conversationId, userId)
                .ifPresent(member -> {
                    member.setLastReadAt(LocalDateTime.now());
                    conversationMemberRepository.save(member);
                });
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getMessages(Long conversationId) {
        List<Message> messageList = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<MessageResponse> responses = new ArrayList<>();
        for (Message msg : messageList) {
            responses.add(mapToMessageResponse(msg));
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getUserConversations(Long currentUserId) {
        List<ConversationMember> memberships = conversationMemberRepository.findByUserId(currentUserId);
        List<ConversationResponse> responses = new ArrayList<>();

        for (ConversationMember member : memberships) {
            Conversation conv = member.getConversation();
            if (conv == null) continue;

            List<ConversationMember> allMembers = conversationMemberRepository.findByConversationId(conv.getId());
            User otherUser = null;
            String convTitle = conv.getTitle();
            String convAvatar = conv.getAvatarUrl();

            ConversationType convType = conv.getType() != null ? conv.getType() : ConversationType.DIRECT;

            if (convType == ConversationType.DIRECT) {
                for (ConversationMember m : allMembers) {
                    if (m.getUser() != null && !m.getUser().getId().equals(currentUserId)) {
                        otherUser = m.getUser();
                        break;
                    }
                }
                if (otherUser == null) continue;
                convTitle = otherUser.getDisplayName();
                convAvatar = otherUser.getAvatarUrl();
            }

            List<Message> recent = messageRepository.findByConversationIdOrderByCreatedAtDesc(conv.getId());
            String lastMessage = "Bắt đầu cuộc trò chuyện mới";
            String lastMessageCiphertext = null;
            String lastMessageIv = null;
            String lastMessageEncryptionVersion = null;
            String lastMessageSha256 = null;
            String lastMessageSenderName = null;
            LocalDateTime lastMessageTime = conv.getCreatedAt() != null ? conv.getCreatedAt() : LocalDateTime.now();

            if (!recent.isEmpty()) {
                Message latest = recent.get(0);
                String senderPrefix = (convType == ConversationType.GROUP && latest.getMessageType() != MessageType.SYSTEM)
                        ? (latest.getSender() != null ? latest.getSender().getDisplayName() + ": " : "")
                        : "";

                if (Boolean.TRUE.equals(latest.getIsDeleted())) {
                    lastMessage = "Tin nhắn đã bị thu hồi";
                } else if (latest.getMessageType() == MessageType.SYSTEM) {
                    lastMessage = latest.getContent();
                } else if (latest.getMessageType() == MessageType.IMAGE) {
                    lastMessage = senderPrefix + "[Hình ảnh]";
                } else if (latest.getMessageType() == MessageType.FILE) {
                    lastMessage = senderPrefix + "[Tệp đính kèm] " + (latest.getFileName() != null ? latest.getFileName() : "");
                } else if (latest.getCiphertext() != null && latest.getIv() != null) {
                    // Frontend sẽ decrypt preview bằng AES key của conversation.
                    lastMessage = "[Tin nhắn được mã hóa]";
                    lastMessageCiphertext = latest.getCiphertext();
                    lastMessageIv = latest.getIv();
                    lastMessageEncryptionVersion = latest.getEncryptionVersion();
                    lastMessageSha256 = latest.getSha256();
                    lastMessageSenderName = latest.getSender() != null ? latest.getSender().getDisplayName() : null;
                } else if (latest.getContent() != null && !latest.getContent().trim().isEmpty()) {
                    lastMessage = senderPrefix + latest.getContent();
                }
                if (latest.getCreatedAt() != null) {
                    lastMessageTime = latest.getCreatedAt();
                }
            }

            long unreadCount = 0;
            if (member.getLastReadAt() == null) {
                unreadCount = messageRepository.countTotalUnread(conv.getId(), currentUserId);
            } else {
                unreadCount = messageRepository.countUnreadAfter(conv.getId(), currentUserId, member.getLastReadAt());
            }

            UserResponse otherUserRes = (otherUser != null) ? UserResponse.builder()
                    .id(otherUser.getId())
                    .username(otherUser.getUsername())
                    .displayName(otherUser.getDisplayName())
                    .avatarUrl(otherUser.getAvatarUrl())
                    .createdAt(otherUser.getCreatedAt())
                    .build() : null;

            responses.add(ConversationResponse.builder()
                    .conversationId(conv.getId())
                    .type(convType)
                    .title(convTitle)
                    .avatarUrl(convAvatar)
                    .theme(conv.getTheme() != null ? conv.getTheme() : "blue")
                    .memberCount(allMembers.size())
                    .otherUser(otherUserRes)
                    .lastMessage(lastMessage)
                    .lastMessageCiphertext(lastMessageCiphertext)
                    .lastMessageIv(lastMessageIv)
                    .lastMessageEncryptionVersion(lastMessageEncryptionVersion)
                    .lastMessageSha256(lastMessageSha256)
                    .lastMessageSenderName(lastMessageSenderName)
                    .lastMessageTime(lastMessageTime)
                    .unreadCount(unreadCount)
                    .build());
        }

        responses.sort((a, b) -> {
            if (a.getLastMessageTime() == null && b.getLastMessageTime() == null) return 0;
            if (a.getLastMessageTime() == null) return 1;
            if (b.getLastMessageTime() == null) return -1;
            return b.getLastMessageTime().compareTo(a.getLastMessageTime());
        });

        return responses;
    }

    private void validateEncryptedPayload(String ciphertext, String iv, String encryptionVersion, String sha256) {
        if (sha256 == null || !sha256.matches("(?i)^[0-9a-f]{64}$")) {
            throw new RuntimeException("Thiếu hoặc sai định dạng SHA-256 của encrypted payload");
        }

        String version = (encryptionVersion == null || encryptionVersion.isBlank())
                ? "AES-256-GCM"
                : encryptionVersion;

        if (!SHA.verifyEncryptedPayload(ciphertext, iv, version, sha256)) {
            throw new RuntimeException("SHA-256 không khớp: encrypted payload có thể đã bị thay đổi");
        }
    }

    private MessageResponse mapToMessageResponse(Message msg) {
        ReplyPreviewResponse replyPreview = null;
        if (msg.getReplyTo() != null) {
            Message reply = msg.getReplyTo();
            String replyContent = "Tin nhắn";
            String replyCiphertext = null;
            String replyIv = null;
            String replyEncryptionVersion = null;
            String replySha256 = null;

            if (Boolean.TRUE.equals(reply.getIsDeleted())) {
                replyContent = "Tin nhắn đã bị thu hồi";
            } else if (reply.getMessageType() == MessageType.IMAGE) {
                replyContent = "[Hình ảnh]";
            } else if (reply.getMessageType() == MessageType.FILE) {
                replyContent = "[Tệp] " + (reply.getFileName() != null ? reply.getFileName() : "");
            } else if (reply.getCiphertext() != null && reply.getIv() != null) {
                // Không decrypt ở backend. Frontend dùng cùng conversation key để decrypt preview.
                replyContent = null;
                replyCiphertext = reply.getCiphertext();
                replyIv = reply.getIv();
                replyEncryptionVersion = reply.getEncryptionVersion();
                replySha256 = reply.getSha256();
            } else if (reply.getContent() != null) {
                replyContent = reply.getContent();
            }

            Long replySenderId = reply.getSender() != null ? reply.getSender().getId() : null;
            String replySenderName = reply.getSender() != null ? reply.getSender().getDisplayName() : "Người dùng";

            replyPreview = ReplyPreviewResponse.builder()
                    .messageId(reply.getId())
                    .senderId(replySenderId)
                    .senderName(replySenderName)
                    .content(replyContent)
                    .ciphertext(replyCiphertext)
                    .iv(replyIv)
                    .encryptionVersion(replyEncryptionVersion)
                    .sha256(replySha256)
                    .build();
        }

        List<ReactionResponse> reactionResponses = new ArrayList<>();
        if (msg.getReactions() != null) {
            for (MessageReaction r : msg.getReactions()) {
                reactionResponses.add(ReactionResponse.builder()
                        .id(r.getId())
                        .userId(r.getUser().getId())
                        .userName(r.getUser().getDisplayName())
                        .reaction(r.getReaction())
                        .build());
            }
        }

        return MessageResponse.builder()
                .id(msg.getId())
                .conversationId(msg.getConversation().getId())
                .senderId(msg.getSender() != null ? msg.getSender().getId() : null)
                .senderName(msg.getSender() != null ? msg.getSender().getDisplayName() : "Hệ thống")
                .content(msg.getContent())
                .ciphertext(msg.getCiphertext())
                .iv(msg.getIv())
                .encryptionVersion(msg.getEncryptionVersion())
                .sha256(msg.getSha256())
                .messageType(msg.getMessageType())
                .mediaUrl(msg.getMediaUrl())
                .fileName(msg.getFileName())
                .fileSize(msg.getFileSize())
                .isEdited(Boolean.TRUE.equals(msg.getIsEdited()))
                .isDeleted(Boolean.TRUE.equals(msg.getIsDeleted()))
                .isPinned(Boolean.TRUE.equals(msg.getIsPinned()))
                .replyTo(replyPreview)
                .reactions(reactionResponses)
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
