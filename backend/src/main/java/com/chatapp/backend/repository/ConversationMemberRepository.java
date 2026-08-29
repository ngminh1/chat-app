package com.chatapp.backend.repository;

import com.chatapp.backend.entity.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {
    List<ConversationMember> findByUserId(Long userId);
    List<ConversationMember> findByConversationId(Long conversationId);
}