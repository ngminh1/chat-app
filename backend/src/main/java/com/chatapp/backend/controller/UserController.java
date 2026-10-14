package com.chatapp.backend.controller;

import com.chatapp.backend.dto.UpdateProfileRequest;
import com.chatapp.backend.dto.UserResponse;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.RequestAccess;
import com.chatapp.backend.security.MediaUrls;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final RequestAccess access;

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUserProfile(
            @PathVariable Long id,
            @RequestBody UpdateProfileRequest request) {
        access.requireSelf(id);
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        if (request.getDisplayName() != null && !request.getDisplayName().trim().isEmpty()) {
            user.setDisplayName(request.getDisplayName().trim());
        }
        if (request.getAvatarUrl() != null) {
            if (!request.getAvatarUrl().equals(user.getAvatarUrl())) {
                MediaUrls.requirePublicAvatarUrl(request.getAvatarUrl());
            }
            user.setAvatarUrl(request.getAvatarUrl().trim());
        }

        User updatedUser = userRepository.save(user);

        return ResponseEntity.ok(UserResponse.builder()
                .id(updatedUser.getId())
                .username(updatedUser.getUsername())
                .displayName(updatedUser.getDisplayName())
                .avatarUrl(updatedUser.getAvatarUrl())
                .createdAt(updatedUser.getCreatedAt())
                .build());
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserResponse>> searchUsers(
            @RequestParam String query,
            @RequestParam Long currentUserId) {
        access.requireSelf(currentUserId);
        List<User> users = userRepository.searchUsers(query, currentUserId);
        List<UserResponse> responses = users.stream()
                .map(u -> UserResponse.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .displayName(u.getDisplayName())
                        .avatarUrl(u.getAvatarUrl())
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(u -> UserResponse.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .displayName(u.getDisplayName())
                        .avatarUrl(u.getAvatarUrl())
                        .createdAt(u.getCreatedAt())
                        .build())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
