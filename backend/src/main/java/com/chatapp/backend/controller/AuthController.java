package com.chatapp.backend.controller;

import com.chatapp.backend.dto.*;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.UserRepository;
import com.chatapp.backend.security.JwtTokenProvider;
import com.chatapp.backend.security.MediaUrls;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        try {
            if (request.getUsername() == null || request.getUsername().trim().isEmpty() ||
                request.getPassword() == null || request.getPassword().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Vui lòng nhập đầy đủ tài khoản và mật khẩu!");
            }

            String username = request.getUsername().trim();
            String rawPassword = request.getPassword();

            User user = userRepository.findByUsername(username).orElse(null);

            if (user == null) {
                log.warn("Đăng nhập thất bại: Không tìm thấy username [{}]", username);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Tài khoản hoặc mật khẩu không chính xác!");
            }

            // BCrypt là đường xác thực duy nhất. Không nhận mật khẩu seed/plaintext chung.
            boolean passwordMatches = user.getPassword() != null
                    && passwordEncoder.matches(rawPassword, user.getPassword());
            if (!passwordMatches) {
                log.warn("Đăng nhập thất bại: sai mật khẩu cho [{}]", username);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body("Tài khoản hoặc mật khẩu không chính xác!");
            }

            String token = tokenProvider.generateToken(user.getId(), user.getUsername());
            log.info("User [{}] đăng nhập thành công", username);

            return ResponseEntity.ok(AuthResponse.builder()
                    .token(token)
                    .id(user.getId())
                    .username(user.getUsername())
                    .displayName(user.getDisplayName() != null ? user.getDisplayName() : user.getUsername())
                    .avatarUrl(user.getAvatarUrl())
                    .build());
        } catch (Exception e) {
            log.error("Lỗi hệ thống khi đăng nhập: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Lỗi hệ thống khi đăng nhập.");
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        MediaUrls.requirePublicAvatarUrl(request.getAvatarUrl());
        try {
            if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Tên đăng nhập không được để trống!");
            }
            if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Mật khẩu không được để trống!");
            }
            if (request.getDisplayName() == null || request.getDisplayName().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Vui lòng nhập tên hiển thị!");
            }

            String username = request.getUsername().trim();
            if (userRepository.existsByUsername(username)) {
                return ResponseEntity.badRequest().body("Tên đăng nhập '" + username + "' đã tồn tại trên hệ thống!");
            }

            String rawPassword = request.getPassword();
            String encodedPassword = passwordEncoder.encode(rawPassword);

            User user = User.builder()
                    .username(username)
                    .password(encodedPassword)
                    .displayName(request.getDisplayName().trim())
                    .avatarUrl(request.getAvatarUrl())
                    .isOnline(false)
                    .build();

            User savedUser = userRepository.save(user);
            log.info("Đăng ký thành công user: [{}], độ dài hash: {}", username, encodedPassword.length());

            String token = tokenProvider.generateToken(savedUser.getId(), savedUser.getUsername());

            return ResponseEntity.ok(AuthResponse.builder()
                    .token(token)
                    .id(savedUser.getId())
                    .username(savedUser.getUsername())
                    .displayName(savedUser.getDisplayName())
                    .avatarUrl(savedUser.getAvatarUrl())
                    .build());
        } catch (Exception e) {
            log.error("Lỗi hệ thống khi đăng ký: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Lỗi hệ thống khi đăng ký.");
        }
    }
}
