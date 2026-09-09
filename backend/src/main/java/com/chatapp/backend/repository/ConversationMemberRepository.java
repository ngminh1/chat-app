package com.chatapp.backend.repository;

import com.chatapp.backend.entity.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {

    @Query("SELECT cm FROM ConversationMember cm JOIN FETCH cm.conversation JOIN FETCH cm.user WHERE cm.user.id = :userId")
    List<ConversationMember> findByUserId(@Param("userId") Long userId);

    @Query("SELECT cm FROM ConversationMember cm JOIN FETCH cm.user WHERE cm.conversation.id = :conversationId")
    List<ConversationMember> findByConversationId(@Param("conversationId") Long conversationId);

    @Query("SELECT cm FROM ConversationMember cm WHERE cm.conversation.id = :conversationId AND cm.user.id = :userId")
    Optional<ConversationMember> findByConversationIdAndUserId(
            @Param("conversationId") Long conversationId,
            @Param("userId") Long userId
    );
}