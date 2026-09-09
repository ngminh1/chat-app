package com.chatapp.backend.repository;

import com.chatapp.backend.entity.Friendship;
import com.chatapp.backend.entity.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("""
        SELECT f FROM Friendship f 
        WHERE (f.requester.id = :user1Id AND f.addressee.id = :user2Id)
           OR (f.requester.id = :user2Id AND f.addressee.id = :user1Id)
    """)
    Optional<Friendship> findFriendshipBetween(@Param("user1Id") Long user1Id, @Param("user2Id") Long user2Id);

    // Lấy danh sách bạn bè đã chấp nhận (status = ACCEPTED)
    @Query("""
        SELECT f FROM Friendship f 
        WHERE (f.requester.id = :userId OR f.addressee.id = :userId)
          AND f.status = 'ACCEPTED'
    """)
    List<Friendship> findAcceptedFriendships(@Param("userId") Long userId);

    // Lấy danh sách lời mời kết bạn gửi đến user hiện tại
    List<Friendship> findByAddresseeIdAndStatus(Long addresseeId, FriendshipStatus status);
}