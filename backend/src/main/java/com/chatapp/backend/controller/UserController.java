package com.chatapp.backend.controller;

import com.chatapp.backend.dto.UpdateProfileRequest;
import com.chatapp.backend.dto.UserResponse;
import com.chatapp.backend.dto.ElGamalPublicKeyRequest;
import com.chatapp.backend.dto.ElGamalPublicKeyResponse;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.RequestAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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


    @PutMapping("/{id}/elgamal-public-key")
    public ResponseEntity<?> registerElGamalPublicKey(
            @PathVariable Long id,
            @RequestBody ElGamalPublicKeyRequest request,
            @AuthenticationPrincipal User authenticatedUser) {
        if (authenticatedUser == null || !authenticatedUser.getId().equals(id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Không được đăng ký public key cho user khác");
        }

        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String publicKey = request.getPublicKey() != null ? request.getPublicKey().trim() : "";
        if (publicKey.isEmpty() || !publicKey.matches("\\d+")) {
            return ResponseEntity.badRequest().body("ElGamal public key không hợp lệ");
        }

        int keyVersion = request.getKeyVersion() != null ? request.getKeyVersion() : 1;
        if (keyVersion < 1) {
            return ResponseEntity.badRequest().body("ElGamal key version không hợp lệ");
        }

        // Không âm thầm thay public key: làm vậy sẽ khiến wrapped key lịch sử không thể giải mã.
        if (user.getElgamalPublicKey() != null
                && !user.getElgamalPublicKey().isBlank()
                && !user.getElgamalPublicKey().equals(publicKey)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Tài khoản đã có ElGamal public key khác. Không tự động ghi đè khóa cũ.");
        }

        user.setElgamalPublicKey(publicKey);
        user.setElgamalKeyVersion(keyVersion);
        userRepository.save(user);

        return ResponseEntity.ok(ElGamalPublicKeyResponse.builder()
                .userId(user.getId())
                .publicKey(user.getElgamalPublicKey())
                .keyVersion(user.getElgamalKeyVersion())
                .build());
    }

    @GetMapping("/{id}/elgamal-public-key")
    public ResponseEntity<ElGamalPublicKeyResponse> getElGamalPublicKey(@PathVariable Long id) {
        return userRepository.findById(id)
                .filter(u -> u.getElgamalPublicKey() != null && !u.getElgamalPublicKey().isBlank())
                .map(u -> ResponseEntity.ok(ElGamalPublicKeyResponse.builder()
                        .userId(u.getId())
                        .publicKey(u.getElgamalPublicKey())
                        .keyVersion(u.getElgamalKeyVersion() != null ? u.getElgamalKeyVersion() : 1)
                        .build()))
                .orElse(ResponseEntity.notFound().build());
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