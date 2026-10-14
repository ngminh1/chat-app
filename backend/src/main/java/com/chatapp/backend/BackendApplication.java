
package com.chatapp.backend;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) {
        // Thống nhất thời gian UTC trên mọi môi trường.
        // Áp dụng trước khi khởi tạo Spring Boot và Hibernate.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        SpringApplication.run(BackendApplication.class, args);
    }
}
