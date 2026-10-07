package com.chatapp.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "conversation_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "role", length = 20)
    private MemberRole role = MemberRole.MEMBER;

    @CreationTimestamp
    private LocalDateTime joinedAt;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;

    /** ElGamal(c1,c2) của AES conversation key dành riêng cho user này. */
    @Column(name = "encrypted_aes_key_c1", columnDefinition = "TEXT")
    private String encryptedAesKeyC1;

    @Column(name = "encrypted_aes_key_c2", columnDefinition = "TEXT")
    private String encryptedAesKeyC2;

    @Column(name = "wrapped_key_version")
    private Integer wrappedKeyVersion;
}