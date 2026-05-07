package com.example.foroservice.Domain.Entities;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;

@Data
@Document(collection = "posts")
public class Post {

    @Id
    private String id;

    private String threadId; // referencia al thread

    private String userId; // microservicio 1

    private String body;

    private int votes;

    @Field("created_at")
    private LocalDateTime date;

}
