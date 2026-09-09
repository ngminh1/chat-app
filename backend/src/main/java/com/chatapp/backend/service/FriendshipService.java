package com.chatapp.backend.service;

import com.chatapp.backend.dto.FriendshipDto;
import com.chatapp.backend.dto.UserDto;
import com.chatapp.backend.entity.Friendship;
import com.chatapp.backend.entity.FriendshipStatus;
import com.chatapp.backend.entity.User;
import com.chatapp.backend.repository.FriendshipRepository;
import com.chatapp.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    public List<FriendshipDto> getFriends(Long userId) {
        List<Friendship> friendships = friendshipRepository.findAcceptedFriendships(userId);
        return friendships.stream().map(f -> {
            User otherUser = f.getRequester().getId().equals(userId) ? f.getAddressee() : f.getRequester();
            return mapToDto(f, otherUser);
        }).collect(Collectors.toList());
    }

    public List<FriendshipDto> getPendingRequests(Long userId) {
        List<Friendship> pendingList = friendshipRepository.findByAddresseeIdAndStatus(userId, FriendshipStatus.PENDING);
        return pendingList.stream()
                .map(f -> mapToDto(f, f.getRequester()))
                .collect(Collectors.toList());
    }

    @Transactional
    public FriendshipDto sendFriendRequest(Long requesterId, Long addresseeId) {
        if (requesterId.equals(addresseeId)) {
            throw new RuntimeException("Không thể tự kết bạn với chính mình");
        }

        friendshipRepository.findFriendshipBetween(requesterId, addresseeId).ifPresent(f -> {
            throw new RuntimeException("Lời mời kết bạn đã tồn tại hoặc đã là bạn bè");
        });

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người gửi"));
        User addressee = userRepository.findById(addresseeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người nhận"));

        Friendship friendship = Friendship.builder()
                .requester(requester)
                .addressee(addressee)
                .status(FriendshipStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        Friendship saved = friendshipRepository.save(friendship);
        return mapToDto(saved, addressee);
    }

    @Transactional
    public FriendshipDto acceptFriendRequest(Long friendshipId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lời mời kết bạn"));
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        Friendship saved = friendshipRepository.save(friendship);
        return mapToDto(saved, friendship.getRequester());
    }

    @Transactional
    public void declineFriendRequest(Long friendshipId) {
        friendshipRepository.deleteById(friendshipId);
    }

    @Transactional
    public void unfriend(Long friendshipId) {
        friendshipRepository.deleteById(friendshipId);
    }

    private FriendshipDto mapToDto(Friendship f, User otherUser) {
        UserDto userDto = UserDto.builder()
                .id(otherUser.getId())
                .username(otherUser.getUsername())
                .displayName(otherUser.getDisplayName())
                .avatarUrl(otherUser.getAvatarUrl())
                .isOnline(otherUser.getIsOnline())
                .lastSeenAt(otherUser.getLastSeenAt())
                .build();

        return FriendshipDto.builder()
                .id(f.getId())
                .status(f.getStatus().name())
                .createdAt(f.getCreatedAt())
                .user(userDto)
                .build();
    }
}