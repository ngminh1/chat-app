package com.chatapp.backend.security;

import com.chatapp.backend.entity.Friendship;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.FriendshipRepository;
import com.chatapp.backend.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Kiểm soát truy cập ở API. ID phía client chỉ để tham chiếu, không phải danh tính.
 * Dùng identity từ JWT đã được filter xác thực.
 */
@Component
@RequiredArgsConstructor
public class RequestAccess {
    private final ConversationMemberRepository members;
    private final MessageRepository messages;
    private final FriendshipRepository friendships;

    public Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Cần đăng nhập");
        }
        return user.getId();
    }

    public void requireSelf(Long userId) {
        if (userId == null || !currentUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không được giả danh người khác");
        }
    }

    public void requireMember(Long conversationId) {
        if (conversationId == null || members.findByConversationIdAndUserId(conversationId, currentUserId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thuộc hội thoại này");
        }
    }

    public void requireMessageMember(Long messageId) {
        Long convId = messages.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tin nhắn"))
                .getConversation().getId();
        requireMember(convId);
    }

    public void requireFriendshipParticipant(Long friendshipId) {
        Friendship friendship = friendships.findById(friendshipId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy quan hệ bạn bè"));
        Long self = currentUserId();
        if (!self.equals(friendship.getRequester().getId()) && !self.equals(friendship.getAddressee().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thuộc quan hệ bạn bè này");
        }
    }

    public void requireFriendshipAddressee(Long friendshipId) {
        Friendship friendship = friendships.findById(friendshipId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lời mời"));
        requireSelf(friendship.getAddressee().getId());
    }
}
