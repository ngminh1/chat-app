package com.chatapp.backend.controller;

import com.chatapp.backend.config.SecurityConfig;
import com.chatapp.backend.entity.ConversationMember;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.ConversationRepository;
import com.chatapp.backend.repository.FriendshipRepository;
import com.chatapp.backend.repository.MessageRepository;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.JwtAuthenticationFilter;
import com.chatapp.backend.security.JwtTokenProvider;
import com.chatapp.backend.security.RequestAccess;
import com.chatapp.backend.service.ChatService;
import com.chatapp.backend.service.FileStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {ChatController.class, HealthController.class,
        MediaController.class, LegacyMediaController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, RequestAccess.class})
class SecurityApiTest {
    @Autowired MockMvc mvc;
    @MockitoBean ChatService chatService;
    @MockitoBean FileStorageService fileStorageService;
    @MockitoBean JwtTokenProvider jwtTokenProvider;
    @MockitoBean UserRepository userRepository;
    @MockitoBean ConversationMemberRepository members;
    @MockitoBean ConversationRepository conversations;
    @MockitoBean MessageRepository messages;
    @MockitoBean FriendshipRepository friendships;

    @Test
    void chatHistoryRequiresJwt() throws Exception {
        mvc.perform(get("/api/chat/conversations/12/messages"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/chat/conversations/12/messages")
                        .header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/uploads/legacy-private-file.png"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/media/files/attachment-12-private.png"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void healthRemainsPublic() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }

    @Test
    void jwtCannotReadAnotherConversation() throws Exception {
        when(jwtTokenProvider.validateToken("valid")).thenReturn(true);
        when(jwtTokenProvider.getUserIdFromJWT("valid")).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(User.builder().id(1L).build()));

        var result = mvc.perform(get("/api/chat/conversations/12/messages")
                        .header("Authorization", "Bearer valid"))
                .andReturn();
        verify(jwtTokenProvider).validateToken("valid");
        verify(jwtTokenProvider).getUserIdFromJWT("valid");
        verify(userRepository).findById(1L);
        org.junit.jupiter.api.Assertions.assertEquals(403, result.getResponse().getStatus());
        verifyNoInteractions(chatService);

        when(members.findByConversationIdAndUserId(12L, 1L))
                .thenReturn(Optional.of(ConversationMember.builder().build()));
        when(chatService.getMessages(12L)).thenReturn(List.of());
        mvc.perform(get("/api/chat/conversations/12/messages")
                        .header("Authorization", "Bearer valid"))
                .andExpect(status().isOk());
    }
}
