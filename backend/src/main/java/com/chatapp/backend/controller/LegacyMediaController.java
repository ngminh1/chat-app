package com.chatapp.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class LegacyMediaController {
    private final MediaController media;

    @GetMapping("/uploads/{fileName:.+}")
    public ResponseEntity<Resource> download(@PathVariable String fileName) {
        return media.downloadLegacyFile(fileName);
    }
}
