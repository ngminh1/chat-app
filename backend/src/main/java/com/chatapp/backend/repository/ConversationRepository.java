package com.chatapp.backend.repository;

import com.chatapp.backend.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Query("""
        SELECT c FROM Conversation c
        JOIN ConversationMember cm1 ON c.id = cm1.conversation.id
        JOIN ConversationMember cm2 ON c.id = cm2.conversation.id
        WHERE c.type = 'DIRECT'
          AND cm1.user.id = :user1Id
          AND cm2.user.id = :user2Id
    """)
    List<Conversation> findDirectConversationBetweenUsers(@Param("user1Id") Long user1Id, @Param("user2Id") Long user2Id);
}