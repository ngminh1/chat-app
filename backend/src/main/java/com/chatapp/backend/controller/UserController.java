package com.chatapp.backend.controller;

import com.chatapp.backend.dto.UserResponse;
import com.chatapp.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService voiceUserService;

    @GetMapping("/search")
    public ResponseEntity<List<UserResponse>> searchUsers(
            @RequestParam String query,
            @RequestParam Long currentUserId) {
        return ResponseEntity.ok(voiceUserService.searchUsers(query, currentUserId));
    }
}