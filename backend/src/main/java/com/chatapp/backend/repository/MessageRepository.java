package com.chatapp.backend.repository;

import com.chatapp.backend.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
    Optional<Message> findTopByConversationIdOrderByCreatedAtDesc(Long conversationId);
}