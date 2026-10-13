package com.chatapp.backend.controller;

import com.chatapp.backend.dto.AuthRequest;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class AuthControllerSecurityTest {

    @Test
    void fixedPasswordCannotOverrideOtherAccounts() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        User user = User.builder().id(12L).username("alice")
                .password("$2a$12$example-hash-not-matching").displayName("Alice").build();
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(encoder.matches("123456", user.getPassword())).thenReturn(false);

        var response = new AuthController(users, encoder, tokens)
                .login(new AuthRequest("alice", "123456"));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(users, never()).save(any());
        verify(tokens, never()).generateToken(any(), any());
    }

    @Test
    void validBcryptPasswordCanLogin() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        User user = User.builder().id(12L).username("alice")
                .password("$2a$12$example-hash").displayName("Alice").build();
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(encoder.matches("correct", user.getPassword())).thenReturn(true);
        when(tokens.generateToken(12L, "alice")).thenReturn("test.jwt.token");

        var response = new AuthController(users, encoder, tokens)
                .login(new AuthRequest("alice", "correct"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(users, never()).save(any());
    }
}
