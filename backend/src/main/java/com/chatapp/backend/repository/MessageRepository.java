package com.chatapp.backend.repository;

import com.chatapp.backend.entity.Message;
import com.chatapp.backend.entity.MessageType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    List<Message> findByConversationIdOrderByCreatedAtDesc(Long conversationId);

    List<Message> findByConversationIdAndIsPinnedTrueOrderByCreatedAtDesc(Long conversationId);

    List<Message> findByConversationIdAndMessageTypeInAndIsDeletedFalseOrderByCreatedAtDesc(
            Long conversationId,
            List<MessageType> messageTypes
    );

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :conversationId AND m.isDeleted = false AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY m.createdAt DESC")
    List<Message> searchMessages(@Param("conversationId") Long conversationId, @Param("query") String query);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.conversation.id = :conversationId AND m.sender.id <> :currentUserId")
    long countTotalUnread(@Param("conversationId") Long conversationId, @Param("currentUserId") Long currentUserId);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.conversation.id = :conversationId AND m.sender.id <> :currentUserId AND m.createdAt > :lastReadAt")
    long countUnreadAfter(@Param("conversationId") Long conversationId, @Param("currentUserId") Long currentUserId, @Param("lastReadAt") LocalDateTime lastReadAt);
}