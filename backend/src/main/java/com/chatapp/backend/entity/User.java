package com.chatapp.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 100)
    private String displayName;

    @Column(length = 500)
    private String avatarUrl;

    @Builder.Default
    @Column(name = "is_online")
    private Boolean isOnline = false;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    /** ElGamal public key; never store unencrypted ElGamal private key. */
    @Column(name = "elgamal_public_key", columnDefinition = "TEXT")
    private String elgamalPublicKey;

    @Builder.Default
    @Column(name = "elgamal_key_version")
    private Integer elgamalKeyVersion = 1;

    /** Recovery-code-encrypted private key (JSON AES-256-GCM vault). */
    @Column(name = "elgamal_vault", columnDefinition = "TEXT")
    private String elgamalVault;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
