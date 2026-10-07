package com.chatapp.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    // Legacy/system/media content. Với TEXT AES mới, field này sẽ NULL.
    @Column(columnDefinition = "TEXT")
    private String content;

    // Ciphertext và IV của TEXT message AES-256-GCM.
    @Column(name = "ciphertext", columnDefinition = "TEXT")
    private String ciphertext;

    @Column(name = "iv", length = 64)
    private String iv;

    @Column(name = "encryption_version", length = 32)
    private String encryptionVersion;

    @Column(name = "sha256", length = 64)
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "message_type", length = 30)
    private MessageType messageType = MessageType.TEXT;

    @Column(name = "media_url", length = 500)
    private String mediaUrl;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "reply_to_id")
    private Message replyTo;

    @Builder.Default
    @Column(name = "is_edited")
    private Boolean isEdited = false;

    @Builder.Default
    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @Builder.Default
    @Column(name = "is_pinned")
    private Boolean isPinned = false;

    @OneToMany(mappedBy = "message", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private List<MessageReaction> reactions = new ArrayList<>();

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
