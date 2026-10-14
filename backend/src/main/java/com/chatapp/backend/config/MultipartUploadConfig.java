package com.chatapp.backend.config;

import jakarta.servlet.MultipartConfigElement;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MultipartUploadConfig {
    private static final long MIB = 1024L * 1024L;

    // Keep the per-file limit aligned with the frontend (25 MiB).
    // Leave 1 MiB for multipart fields and boundaries.
    @Bean
    public MultipartConfigElement multipartConfigElement() {
        return new MultipartConfigElement("", 25L * MIB, 26L * MIB, 0);
    }
}
