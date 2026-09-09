package com.chatapp.backend.repository;

import com.chatapp.backend.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Query("""
        SELECT c FROM Conversation c 
        JOIN ConversationMember cm1 ON cm1.conversation = c 
        JOIN ConversationMember cm2 ON cm2.conversation = c 
        WHERE cm1.user.id = :user1Id AND cm2.user.id = :user2Id
    """)
    List<Conversation> findDirectConversationBetweenUsers(
            @Param("user1Id") Long user1Id,
            @Param("user2Id") Long user2Id
    );
}