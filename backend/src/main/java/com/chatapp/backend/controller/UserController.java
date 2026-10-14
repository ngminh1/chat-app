
package com.chatapp.backend.controller;

import com.chatapp.backend.dto.UpdateProfileRequest;
import com.chatapp.backend.dto.UserResponse;
import com.chatapp.backend.dto.ElGamalPublicKeyRequest;
import com.chatapp.backend.dto.ElGamalPublicKeyResponse;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.RequestAccess;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Base64;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final RequestAccess access;
    private final ObjectMapper objectMapper;

    // Cập nhật thông tin người dùng.
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUserProfile(
            @PathVariable Long id,
            @RequestBody UpdateProfileRequest request) {

        access.requireSelf(id);

        User user = userRepository.findById(id).orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        if (request.getDisplayName() != null
                && !request.getDisplayName().trim().isEmpty()) {

            user.setDisplayName(request.getDisplayName().trim());
        }

        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl().trim());
        }

        User updatedUser = userRepository.save(user);

        return ResponseEntity.ok(
                UserResponse.builder()
                        .id(updatedUser.getId())
                        .username(updatedUser.getUsername())
                        .displayName(updatedUser.getDisplayName())
                        .avatarUrl(updatedUser.getAvatarUrl())
                        .createdAt(updatedUser.getCreatedAt())
                        .build()
        );
    }

    // Đăng ký public key ElGamal.
    // Không cho phép ghi đè public key đã tồn tại.
    @PutMapping("/{id}/elgamal-public-key")
    public ResponseEntity<?> registerElGamalPublicKey(
            @PathVariable Long id,
            @RequestBody ElGamalPublicKeyRequest request) {

        access.requireSelf(id);

        User user = userRepository.findById(id).orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String publicKey = request.getPublicKey() != null
                ? request.getPublicKey().trim()
                : "";

        if (publicKey.isEmpty() || !publicKey.matches("\\d+")) {
            return ResponseEntity.badRequest()
                    .body("ElGamal public key không hợp lệ");
        }

        int keyVersion = request.getKeyVersion() != null
                ? request.getKeyVersion()
                : 1;

        if (keyVersion < 1) {
            return ResponseEntity.badRequest()
                    .body("ElGamal key version không hợp lệ");
        }

        if (user.getElgamalPublicKey() != null
                && !user.getElgamalPublicKey().isBlank()
                && !user.getElgamalPublicKey().equals(publicKey)) {

            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(
                            "Tài khoản đã có ElGamal public key khác. "
                            + "Không tự động ghi đè khóa cũ."
                    );
        }

        user.setElgamalPublicKey(publicKey);
        user.setElgamalKeyVersion(keyVersion);

        userRepository.save(user);

        return ResponseEntity.ok(
                ElGamalPublicKeyResponse.builder()
                        .userId(user.getId())
                        .publicKey(user.getElgamalPublicKey())
                        .keyVersion(user.getElgamalKeyVersion())
                        .build()
        );
    }

    // Lấy public key của người dùng.
    @GetMapping("/{id}/elgamal-public-key")
    public ResponseEntity<ElGamalPublicKeyResponse> getElGamalPublicKey(
            @PathVariable Long id) {

        return userRepository.findById(id)
                .filter(user ->
                        user.getElgamalPublicKey() != null
                        && !user.getElgamalPublicKey().isBlank()
                )
                .map(user -> ResponseEntity.ok(
                        ElGamalPublicKeyResponse.builder()
                                .userId(user.getId())
                                .publicKey(user.getElgamalPublicKey())
                                .keyVersion(
                                        user.getElgamalKeyVersion() != null
                                                ? user.getElgamalKeyVersion()
                                                : 1
                                )
                                .build()
                ))
                .orElse(ResponseEntity.notFound().build());
    }

    // Lấy vault đã mã hóa của tài khoản hiện tại.
    // Backend không giải mã private key.
    @GetMapping("/me/elgamal-vault")
    public ResponseEntity<?> getOwnElgamalVault() {

        Long userId = access.currentUserId();

        User user = userRepository.findById(userId).orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> data = new LinkedHashMap<>();

        data.put("publicKey", user.getElgamalPublicKey());
        data.put("keyVersion", user.getElgamalKeyVersion());

        try {
            JsonNode wrappedPrivateKey =
                    user.getElgamalVault() == null
                            ? null
                            : objectMapper.readTree(
                                    user.getElgamalVault()
                            );

            data.put("wrappedPrivateKey", wrappedPrivateKey);

        } catch (JacksonException ex) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Khóa sao lưu trên server không hợp lệ");
        }

        return ResponseEntity.ok(data);
    }

    // Lưu vault đã mã hóa một lần.
    // Không thay thế public key hoặc vault cũ.
    @PutMapping("/me/elgamal-vault")
    @Transactional
    public ResponseEntity<?> saveOwnElgamalVault(
            @RequestBody JsonNode request) {

        Long userId = access.currentUserId();

        JsonNode publicNode =
                request == null ? null : request.get("publicKey");

        JsonNode blob =
                request == null ? null : request.get("wrappedPrivateKey");

        // Jackson 3: isString() thay cho isTextual().
        if (publicNode == null
                || !publicNode.isString()
                || blob == null
                || !blob.isObject()) {

            return ResponseEntity.badRequest()
                    .body("Thiếu publicKey hoặc wrappedPrivateKey");
        }

        // Jackson 3: asString() thay cho asText().
        String publicKey = publicNode.asString();

        if (!publicKey.matches("[0-9]{1,700}")) {
            return ResponseEntity.badRequest()
                    .body("Public key không hợp lệ");
        }

        if (blob.path("version").asInt(-1) != 1
                || !"PBKDF2-SHA256".equals(
                        blob.path("kdf").asString()
                )
                || blob.path("iterations").asInt(0) < 100_000
                || blob.path("iterations").asInt(0) > 1_000_000
                || !validBase64(
                        blob.path("salt").asString(),
                        16,
                        16
                )
                || !validBase64(
                        blob.path("iv").asString(),
                        12,
                        12
                )
                || !validBase64(
                        blob.path("ciphertext").asString(),
                        17,
                        10000
                )) {

            return ResponseEntity.badRequest()
                    .body("Wrapped private key không hợp lệ");
        }

        String serialized = blob.toString();

        if (serialized.length() > 16000) {
            return ResponseEntity.badRequest()
                    .body("Vault quá lớn");
        }

        int written = userRepository.installElgamalVault(
                userId,
                publicKey,
                serialized
        );

        if (written != 1) {
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(
                            "Không thể sao lưu: public key không khớp, "
                            + "chưa đăng ký hoặc đã tồn tại vault"
                    );
        }

        return ResponseEntity.noContent().build();
    }

    // Kiểm tra dữ liệu Base64 và độ dài.
    private static boolean validBase64(
            String value,
            int minBytes,
            int maxBytes) {

        if (value == null || value.length() > 15000) {
            return false;
        }

        try {
            int count = Base64.getDecoder()
                    .decode(value)
                    .length;

            return count >= minBytes && count <= maxBytes;

        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    // Tìm kiếm người dùng.
    @GetMapping("/search")
    public ResponseEntity<List<UserResponse>> searchUsers(
            @RequestParam String query,
            @RequestParam Long currentUserId) {

        access.requireSelf(currentUserId);

        List<User> users = userRepository.searchUsers(
                query,
                currentUserId
        );

        List<UserResponse> responses = users.stream()
                .map(user ->
                        UserResponse.builder()
                                .id(user.getId())
                                .username(user.getUsername())
                                .displayName(user.getDisplayName())
                                .avatarUrl(user.getAvatarUrl())
                                .createdAt(user.getCreatedAt())
                                .build()
                )
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    // Lấy thông tin người dùng theo ID.
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(
            @PathVariable Long id) {

        return userRepository.findById(id)
                .map(user ->
                        UserResponse.builder()
                                .id(user.getId())
                                .username(user.getUsername())
                                .displayName(user.getDisplayName())
                                .avatarUrl(user.getAvatarUrl())
                                .createdAt(user.getCreatedAt())
                                .build()
                )
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
