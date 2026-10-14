package com.chatapp.backend.controller;

import com.chatapp.backend.dto.FileUploadResponse;
import com.chatapp.backend.entity.Conversation;
import com.chatapp.backend.entity.ConversationMember;
import com.chatapp.backend.entity.Message;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.ConversationMemberRepository;
import com.chatapp.backend.repository.ConversationRepository;
import com.chatapp.backend.repository.FriendshipRepository;
import com.chatapp.backend.repository.MessageRepository;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.MediaUrls;
import com.chatapp.backend.security.RequestAccess;
import com.chatapp.backend.service.FileStorageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaControllerSecurityTest {
    private final FileStorageService storage = mock(FileStorageService.class);
    private final ConversationMemberRepository members = mock(ConversationMemberRepository.class);
    private final MessageRepository messages = mock(MessageRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ConversationRepository conversations = mock(ConversationRepository.class);
    private final RequestAccess access = new RequestAccess(members, messages, mock(FriendshipRepository.class));
    private final MediaController controller = new MediaController(storage, access,
            members, messages, users, conversations);

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    private void login() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(User.builder().id(1L).build(), null, List.of()));
    }

    @Test
    void privateDownloadRequiresJwtAndCurrentMembership() {
        String name = "attachment-20-random.png";
        String url = MediaUrls.FILES + name;
        Message reference = Message.builder()
                .conversation(Conversation.builder().id(20L).build()).build();
        when(messages.findByMediaUrlAndIsDeletedFalse(url)).thenReturn(List.of(reference));

        assertEquals(HttpStatus.UNAUTHORIZED,
                assertThrows(ResponseStatusException.class,
                        () -> controller.downloadFile(name)).getStatusCode());

        login();
        assertEquals(HttpStatus.FORBIDDEN,
                assertThrows(ResponseStatusException.class,
                        () -> controller.downloadFile(name)).getStatusCode());
        verify(storage, never()).loadFileAsResource(name);

        when(members.findByConversationIdAndUserId(20L, 1L))
                .thenReturn(Optional.of(ConversationMember.builder().build()));
        Resource resource = mock(Resource.class);
        when(resource.getFilename()).thenReturn(name);
        when(storage.loadFileAsResource(name)).thenReturn(resource);
        var response = controller.downloadFile(name);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(MediaType.IMAGE_PNG, response.getHeaders().getContentType());
        assertTrue(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION).startsWith("attachment"));

        when(members.findByConversationIdAndUserId(20L, 1L)).thenReturn(Optional.empty());
        assertEquals(HttpStatus.FORBIDDEN,
                assertThrows(ResponseStatusException.class,
                        () -> controller.downloadFile(name)).getStatusCode());
    }

    @Test
    void avatarAndExistingLegacyAvatarRemainPublic() {
        Resource resource = mock(Resource.class);
        when(resource.getFilename()).thenReturn("avatar-random.png", "old-avatar.png");
        when(storage.loadFileAsResource(anyString())).thenReturn(resource);
        var avatar = controller.downloadFile("avatar-random.png");
        assertEquals(HttpStatus.OK, avatar.getStatusCode());
        assertTrue(avatar.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION).startsWith("inline"));

        when(users.existsByAvatarUrl(MediaUrls.FILES + "old-avatar.png")).thenReturn(true);
        assertEquals(HttpStatus.OK, controller.downloadFile("old-avatar.png").getStatusCode());
    }

    @Test
    void attachmentUploadRequiresMembershipWhileAvatarUploadSupportsRegistration() {
        MockMultipartFile file = new MockMultipartFile("file", "image.png", "image/png", new byte[] {1});
        assertEquals(HttpStatus.UNAUTHORIZED,
                assertThrows(ResponseStatusException.class,
                        () -> controller.uploadFile(file, "attachment", 20L)).getStatusCode());
        login();
        assertEquals(HttpStatus.FORBIDDEN,
                assertThrows(ResponseStatusException.class,
                        () -> controller.uploadFile(file, "attachment", 20L)).getStatusCode());
        when(members.findByConversationIdAndUserId(20L, 1L))
                .thenReturn(Optional.of(ConversationMember.builder().build()));
        when(storage.storeFile(file, false, 20L)).thenReturn(new FileUploadResponse());
        assertEquals(HttpStatus.OK, controller.uploadFile(file, "attachment", 20L).getStatusCode());

        SecurityContextHolder.clearContext();
        when(storage.storeFile(file, true, null)).thenReturn(new FileUploadResponse());
        assertEquals(HttpStatus.OK, controller.uploadFile(file, "avatar", null).getStatusCode());
    }

    @Test
    void privateFileCannotBePromotedToPublicAvatar() {
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class,
                        () -> MediaUrls.requirePublicAvatarUrl(
                                "/api/media/files/attachment-20-random.png")).getStatusCode());
        assertDoesNotThrow(() -> MediaUrls.requirePublicAvatarUrl(
                "/api/media/files/avatar-random.png"));
    }

    @Test
    void legacyUploadsRouteAlsoChecksMessageMembership() {
        String name = "old-private.png";
        String url = "/uploads/" + name;
        Message reference = Message.builder()
                .conversation(Conversation.builder().id(20L).build()).build();
        when(messages.findByMediaUrlAndIsDeletedFalse(url)).thenReturn(List.of(reference));
        var legacy = new LegacyMediaController(controller);
        assertEquals(HttpStatus.UNAUTHORIZED,
                assertThrows(ResponseStatusException.class,
                        () -> legacy.download(name)).getStatusCode());
        login();
        assertEquals(HttpStatus.FORBIDDEN,
                assertThrows(ResponseStatusException.class,
                        () -> legacy.download(name)).getStatusCode());
        when(members.findByConversationIdAndUserId(20L, 1L))
                .thenReturn(Optional.of(ConversationMember.builder().build()));
        Resource resource = mock(Resource.class);
        when(resource.getFilename()).thenReturn(name);
        when(storage.loadFileAsResource(name)).thenReturn(resource);
        assertEquals(HttpStatus.OK, legacy.download(name).getStatusCode());
    }
}
