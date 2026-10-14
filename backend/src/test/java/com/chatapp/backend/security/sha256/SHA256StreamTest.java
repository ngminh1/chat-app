package com.chatapp.backend.security.sha256;

import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class SHA256StreamTest {
    @Test
    void knownVectorFromStream() throws IOException {
        byte[] bytes = "abc".getBytes(StandardCharsets.UTF_8);
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                SHA256.hashStream(new ByteArrayInputStream(bytes)));
    }

    @Test
    void readsAcrossMultipleChunks() throws IOException {
        byte[] bytes = new byte[30000];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) (i * 7);
        assertEquals(SHA256.hashBytes(bytes), SHA256.hashStream(new ByteArrayInputStream(bytes)));
    }

    @Test
    void alteredBytesHaveDifferentHash() throws IOException {
        byte[] bytes = "Dispatch-file".getBytes(StandardCharsets.UTF_8);
        String first = SHA256.hashStream(new ByteArrayInputStream(bytes));
        bytes[0] ^= 1;
        assertNotEquals(first, SHA256.hashStream(new ByteArrayInputStream(bytes)));
    }

    @Test
    void propagatesIoFailure() {
        InputStream broken = new InputStream() {
            @Override public int read() throws IOException { throw new IOException("disk failure"); }
            @Override public int read(byte[] bytes, int off, int length) throws IOException {
                throw new IOException("disk failure");
            }
        };
        assertThrows(IOException.class, () -> SHA256.hashStream(broken));
    }
}
