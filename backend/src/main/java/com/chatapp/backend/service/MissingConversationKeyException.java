package com.chatapp.backend.service;

/** Encrypted history exists, so generating a replacement key would strand that history. */
public class MissingConversationKeyException extends IllegalStateException {
    public MissingConversationKeyException() {
        super("Hội thoại có tin mã hóa nhưng mất khóa AES");
    }
}
