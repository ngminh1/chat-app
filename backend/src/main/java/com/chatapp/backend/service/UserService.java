package com.chatapp.backend.service;

import com.chatapp.backend.dto.UserResponse;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public List<UserResponse> searchUsers(String query, Long currentUserId) {
        List<User> users = (query == null || query.trim().isEmpty())
                ? List.of()
                : userRepository.searchUsers(query.trim(), currentUserId);

        return users.stream()
                .map(user -> UserResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .displayName(user.getDisplayName())
                        .avatarUrl(user.getAvatarUrl())
                        .createdAt(user.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }
}