package com.chatapp.backend.repository;

import com.chatapp.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    @Query("SELECT u FROM User u WHERE (LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :query, '%'))) AND u.id <> :currentUserId")
    List<User> searchUsers(@Param("query") String query, @Param("currentUserId") Long currentUserId);

    // Atomic write-once vault installation, bound to the immutable public key.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE User u SET u.elgamalVault = :blob WHERE u.id = :userId " +
           "AND u.elgamalPublicKey = :publicKey AND u.elgamalVault IS NULL")
    int installElgamalVault(@Param("userId") Long userId,
                            @Param("publicKey") String publicKey,
                            @Param("blob") String blob);
}
