package com.chatapp.backend.repository;

import com.chatapp.backend.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    // Lấy danh sách tin nhắn theo cuộc trò chuyện, sắp xếp theo thời gian gửi
    List<Message> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
}