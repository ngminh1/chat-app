package com.chatapp.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "conversations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConversationType type;

    @Column(name = "title")
    private String title;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Builder.Default
    @Column(name = "theme", length = 50)
    private String theme = "blue";

    /**
     * DEV ONLY: raw AES-256 key ở dạng Base64.
     * Dùng để hai client trong cùng conversation lấy được cùng AES key khi phase này
     * chưa triển khai key exchange. Backend vì thế biết key => chưa phải E2EE.
     */
    @JsonIgnore
    @Column(name = "aes_key", length = 100)
    private String aesKey;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
