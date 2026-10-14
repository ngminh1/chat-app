package com.chatapp.backend.controller;

import com.chatapp.backend.dto.FriendshipDto;
import com.chatapp.backend.service.FriendshipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/friends", "/api/friendships"})
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FriendshipController {

    private final FriendshipService friendshipService;

    // 1. Lấy danh sách bạn bè đã chấp nhận (ACCEPTED)
    @GetMapping("/{userId}")
    public ResponseEntity<List<FriendshipDto>> getFriends(@PathVariable Long userId) {
        return ResponseEntity.ok(friendshipService.getFriends(userId));
    }

    // 2. Lấy danh sách lời mời kết bạn đang chờ duyệt (PENDING) gửi tới userId
    @GetMapping("/pending/{userId}")
    public ResponseEntity<List<FriendshipDto>> getPendingRequests(@PathVariable Long userId) {
        return ResponseEntity.ok(friendshipService.getPendingRequests(userId));
    }

    // 3. Gửi lời mời kết bạn
    @PostMapping("/request")
    public ResponseEntity<FriendshipDto> sendFriendRequest(
            @RequestParam Long requesterId,
            @RequestParam Long addresseeId) {
        return ResponseEntity.ok(friendshipService.sendFriendRequest(requesterId, addresseeId));
    }

    // 4. Chấp nhận lời mời kết bạn
    @PutMapping("/{friendshipId}/accept")
    public ResponseEntity<FriendshipDto> acceptFriendRequest(@PathVariable Long friendshipId) {
        return ResponseEntity.ok(friendshipService.acceptFriendRequest(friendshipId));
    }

    // 5. Từ chối lời mời kết bạn
    @PutMapping("/{friendshipId}/decline")
    public ResponseEntity<Void> declineFriendRequest(@PathVariable Long friendshipId) {
        friendshipService.declineFriendRequest(friendshipId);
        return ResponseEntity.ok().build();
    }

    // 6. Hủy kết bạn
    @DeleteMapping("/{friendshipId}")
    public ResponseEntity<Void> unfriend(@PathVariable Long friendshipId) {
        friendshipService.unfriend(friendshipId);
        return ResponseEntity.ok().build();
    }
}